/**
 * Pro tips for the provider home card.
 *
 * Fifty of them, rotating, so the card stops saying the same sentence every
 * session. They are deliberately a mix: some are about using Fixhomi, most are
 * about running a small trade business well — pricing, punctuality, dealing
 * with customers, safety, tools, money. A card that only ever advertises the
 * app stops being read after a week.
 *
 * Rules, enforced by proTips.test.js:
 *   - 110 characters or fewer, so the card never grows past two lines on a
 *     320pt screen at the largest accessible font scale.
 *   - No emoji. This is a professional surface.
 *   - No duplicates.
 *
 * NOT translated. These are long-form advisory copy, and 50 x 3 languages of
 * hand-written prose is a translation job, not a string table — shipping
 * machine-translated trade advice to providers who rely on it is worse than
 * shipping it in English. The label above the card ("PRO TIP") is translated.
 * Tracked for a proper pass with a native speaker.
 */

export const PRO_TIPS = [
  // Using the app
  'Stay online during peak hours, 9 AM to 6 PM, to receive noticeably more requests.',
  'Complete every verification step. Verified profiles are shown to customers first.',
  'Add a clear profile photo. Customers book faces they can see far more often.',
  'Reply to a new request within five minutes. Most customers book whoever answers first.',
  'Keep your service list accurate. Wrong categories bring jobs you cannot take.',
  'Set your working hours honestly. Being offline beats missing a booked job.',
  'Write a short intro about your work. It is the first thing a customer reads.',
  'Ask satisfied customers to rate you. Ratings compound into more work.',
  'Keep your address current so nearby jobs actually reach you.',
  'Upload your documents once, properly. Rejected uploads delay every future job.',

  // Pricing and money
  'Quote the full price before starting. Surprises at the end cost you the repeat job.',
  'Charge for a diagnosis visit. Your time looking at a problem has value.',
  'Round your quote to a clean number. It reads as confidence, not guesswork.',
  'Keep a small buffer in every quote for the fault you have not found yet.',
  'Never lower a price without removing something from the job.',
  'Track what each job earns per hour, not per visit. The short ones often pay better.',
  'Collect payment before you leave the site. Chasing money later costs more than the job.',
  'Keep business money separate from household money, even if it is two envelopes.',
  'Raise your rate once a year. Costs rise whether or not your price does.',
  'Give a written estimate for anything above a few thousand rupees.',

  // Customers
  'Call if you will be late. Ten minutes of warning prevents a one-star review.',
  'Explain the fault in plain words. Customers pay more willingly when they understand.',
  'Show the customer the old part you replaced. It settles most disputes before they start.',
  'Tidy the site before you leave. It is remembered longer than the repair.',
  'Give a realistic timeline, then beat it. Never the other way round.',
  'Listen to the whole complaint before opening your toolbox.',
  'Put your guarantee in writing, even one line. It closes hesitant customers.',
  'Follow up two days later. One message turns a job into a regular customer.',
  'Turn down work outside your skill. A bad job travels further than a good one.',
  'Remove your shoes without being asked. Small courtesies get remembered.',

  // Craft and tools
  'Photograph the wiring before you disconnect anything. It will save you twice a year.',
  'Carry spares of the three parts you replace most. One trip beats two.',
  'Clean and check your tools weekly. A failed tool on site costs a whole day.',
  'Label your cables. Future you is a stranger who will not remember.',
  'Test the circuit after every repair, in front of the customer.',
  'Keep the manual for anything you install. Warranty claims need it.',
  'Buy the better tool once. The cheap one is bought three times.',
  'Keep a torch and a spare battery in the bag, not in the vehicle.',
  'Measure twice. The second measurement is always cheaper than the second trip.',
  'Learn one new skill each quarter. It is the only thing that raises your ceiling.',

  // Safety and admin
  'Switch off at the mains, then test. Assume every wire is live until proven otherwise.',
  'Wear the gloves even for the two-minute job. That is the one that catches people.',
  'Keep your insurance current. One accident without it ends a business.',
  'Do not work alone on a ladder above two metres.',
  'Keep a written record of every job. Memory is a poor defence in a dispute.',
  'Store customer numbers properly. A lost contact is a lost repeat job.',
  'Take a photo of the finished work. It is your portfolio and your proof.',
  'Rest properly between long jobs. Tired hands make expensive mistakes.',
  'Keep a first aid kit in your bag and know what is in it.',
  'Renew licences a month early. Expired paperwork stops work instantly.',
];

/**
 * Pick a tip that changes but is stable within a session.
 *
 * Deterministic on the seed so the card does not flicker to a different tip on
 * every re-render — the provider home re-renders often (socket updates,
 * availability changes) and a tip that changed each time would be unreadable.
 * Pass a value that is stable for as long as you want the tip to persist;
 * the default rotates roughly every few hours.
 */
export const pickProTip = (seed = Math.floor(Date.now() / (1000 * 60 * 60 * 4))) =>
  PRO_TIPS[((seed % PRO_TIPS.length) + PRO_TIPS.length) % PRO_TIPS.length];

export default { PRO_TIPS, pickProTip };
