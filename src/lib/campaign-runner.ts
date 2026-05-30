import { db } from '@/db'
import { campaigns, contacts, calls } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function runCampaign(campaignId: string) {
  // Fetch campaign
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))

  if (!campaign) {
    console.error(`[campaign-runner] Campaign ${campaignId} not found`)
    return
  }

  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const callbackUrl = `${appUrl}/api/cdr`

  let campaignTemplateVars: Record<string, string> = {}
  try {
    campaignTemplateVars = JSON.parse(campaign.template_vars)
  } catch {
    campaignTemplateVars = {}
  }

  console.log(`[campaign-runner] Starting campaign ${campaignId} (${campaign.name})`)

  // Get all pending contacts for this campaign
  const pendingContacts = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.campaign_id, campaignId), eq(contacts.status, 'pending')))

  for (const contact of pendingContacts) {
    // Check campaign status before each call
    const [freshCampaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))

    if (!freshCampaign || freshCampaign.status === 'paused' || freshCampaign.status === 'completed') {
      console.log(`[campaign-runner] Campaign ${campaignId} is ${freshCampaign?.status}, stopping loop`)
      break
    }

    // Merge template vars: campaign vars + {name: first_name} + contact extra_vars
    let contactExtraVars: Record<string, string> = {}
    try {
      contactExtraVars = JSON.parse(contact.extra_vars)
    } catch {
      contactExtraVars = {}
    }

    const mergedTemplateVars: Record<string, string> = {
      ...campaignTemplateVars,
      ...(contact.first_name ? { name: contact.first_name } : {}),
      ...contactExtraVars,
    }

    const payload = {
      destination: contact.phone,
      agent_slug: campaign.agent_slug,
      callback_url: callbackUrl,
      metadata: {
        campaign_id: campaignId,
        contact_id: contact.id,
      },
      template_vars: mergedTemplateVars,
    }

    try {
      const response = await fetch(`${campaign.voip_base_url}/api/outbound/originate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`VoIP API returned ${response.status}: ${await response.text()}`)
      }

      const result = await response.json()
      const callUuid = result.call_uuid || result.uuid || null

      // Create call record
      const callId = crypto.randomUUID()
      await db.insert(calls).values({
        id: callId,
        campaign_id: campaignId,
        contact_id: contact.id,
        call_uuid: callUuid,
        destination: contact.phone,
        status: 'calling',
        created_at: new Date().toISOString(),
      })

      // Mark contact as calling
      await db
        .update(contacts)
        .set({ status: 'calling', call_uuid: callUuid })
        .where(eq(contacts.id, contact.id))

      console.log(`[campaign-runner] Call initiated for contact ${contact.id} (${contact.phone}), uuid: ${callUuid}`)
    } catch (err) {
      console.error(`[campaign-runner] Failed to originate call for contact ${contact.id}:`, err)
      // Mark contact as failed
      await db
        .update(contacts)
        .set({ status: 'failed' })
        .where(eq(contacts.id, contact.id))
    }

    // Sleep between calls to avoid hammering the VoIP API
    await sleep(1000)
  }

  // Check if all contacts are done — mark campaign completed
  const [remaining] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.campaign_id, campaignId), eq(contacts.status, 'pending')))

  if (!remaining) {
    const [currentStatus] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))

    if (currentStatus?.status === 'active') {
      await db
        .update(campaigns)
        .set({ status: 'completed', updated_at: new Date().toISOString() })
        .where(eq(campaigns.id, campaignId))
      console.log(`[campaign-runner] Campaign ${campaignId} completed`)
    }
  }
}
