# Information Foraging Theory

Users on the web behave like animals foraging for food. They follow scent trails — link text, headings, snippets — and abandon paths that smell wrong. Information foraging theory, developed by Peter Pirolli and Stuart Card at Xerox PARC in the late 1990s, applies optimal foraging theory from behavioral ecology to explain how people search for information online. The theory is predictive, not just descriptive: it tells you *why* users leave your page and *what* will make them stay.

## The Principle

Information foraging theory (Pirolli & Card, 1999) rests on the idea that humans have evolved to be efficient foragers, and the same cost-benefit logic that governs a predator selecting prey applies to a user selecting links. The core concepts are:

**Information scent** is the perceived likelihood that a path (a link, a heading, a menu item) will lead to the desired information. Scent is assessed from proximal cues — the link text, a thumbnail, a search snippet — not from the actual content at the destination. A link labeled "Pricing" has strong scent for someone looking for cost information; a link labeled "Learn more" has weak scent because it reveals nothing about what will be learned.

**Information patches** are clusters of related information — a page, a section, a search results list. Like an animal grazing in a berry patch, a user extracts information from a patch until the rate of finding useful content drops below the expected rate of finding it elsewhere. At that point, the user leaves the patch (clicks back, tries a different query) to forage in a new one.

**The diet model** describes which information items a user will pursue. Just as an optimal forager ignores low-calorie prey when high-calorie prey is abundant, a user ignores low-relevance links when high-relevance links are available. But when scent is uniformly weak, users become less selective and begin clicking on marginal links — a pattern called **pogosticking** (bouncing back and forth between a results page and disappointing destinations).

The theory also connects to Herbert Simon's concept of **satisficing** (Simon, 1956): people do not seek the best possible answer — they seek an answer that is good enough. Users stop foraging when they find information that meets their threshold of acceptability, even if better information exists elsewhere. This means that the *first* reasonable result often wins, placing enormous pressure on the quality of initial scent cues.

The foraging framework explains several common web behaviors:

- **Back-button navigation**: the user followed a scent trail that did not pay off, so they return to the previous patch to try a different trail.
- **Query reformulation**: the user's initial search yielded low-scent results, so they modify the query to improve scent.
- **Tab hoarding**: the user opens multiple promising links in background tabs — a strategy to reduce the cost of switching between patches.
- **F-pattern scanning**: eye-tracking studies (Nielsen, 2006) show users scan pages in an F-shape, focusing on headings and the first few words of each line — exactly where scent cues are concentrated.

## Design Implications

- **Write descriptive link text.** "Click here" and "Learn more" are zero-scent labels. Replace them with text that predicts the destination: "View pricing plans," "Read the API documentation," "Download the 2024 annual report." Every link should answer the user's implicit question: "What will I find if I click this?"
- **Make search snippets preview content.** Search result pages should show enough context — a title, URL, and relevant excerpt — for the user to assess scent without clicking. Google's featured snippets and knowledge panels succeed precisely because they deliver the information without requiring the user to leave the patch.
- **Use clear headings as scent cues.** When scanning a long page, users forage by heading. A heading like "Configuration" tells the reader what the section contains; a heading like "Section 3" does not. Headings should be front-loaded with the most informative words.
- **Provide breadcrumbs.** Breadcrumbs serve dual purposes: they tell the user where they are (reducing the gulf of evaluation) and they provide scent cues for nearby patches (parent and sibling pages).
- **Prevent pogosticking with adequate previews.** If users repeatedly click a link, scan the page, and immediately click back, the link's scent is misleading. Tooltips, hover previews, and expandable summaries let users assess content before committing to a navigation action.

## The Evidence

The foundational paper is **Pirolli & Card (1999)**, "Information Foraging," published in *Psychological Review*. They developed a formal computational model — the ACT-IF (Adaptive Control of Thought — Information Foraging) framework — that treats web navigation as a decision process analogous to optimal foraging. The model predicts that users will follow links whose scent (estimated relevance based on word similarity between the user's goal and the link text) exceeds a threshold, and will leave a page when the rate of information gain drops below the average rate across all available patches.

Pirolli and Card tested the model against log data from web browsing sessions and found that it predicted navigation paths with reasonable accuracy. The model correctly predicted which links users would follow from a given page based solely on the textual similarity between the link labels and the user's stated information goal.

**Chi, Pirolli, Chen & Pitkow (2001)** extended this work with the "Scent Model of Web Navigation," which predicted users' web navigation paths by computing scent from the spreading activation of goal-related words through the link structure. Tested against clickstream data from thousands of users on real websites, the model predicted the most common navigation paths with significantly better accuracy than random or frequency-based baselines.

**Spool, Perfetti & Brittan (2004)** provided the most actionable finding for designers. In a study of usability tests across multiple sites, they found that **link text quality was the single strongest predictor of task success** — stronger than site architecture, page layout, or visual design. When links clearly described their destination, users succeeded; when link text was vague or misleading, users failed, regardless of how well the rest of the site was designed.

<details>
<summary>Deep Dive: Methodology & Replications</summary>

<p>Pirolli and Card's (1999) ACT-IF model is rooted in Anderson's ACT-R cognitive architecture. The model treats each link on a page as a "prey item" with a certain "profitability" (information value divided by handling time). The user's "diet" — the set of links they will pursue — is determined by ranking all links by profitability and including links until the marginal return of adding the next link drops below the average return of the current diet. This is directly analogous to the prey choice model in behavioral ecology (Stephens & Krebs, 1986).</p>

<p>Chi et al. (2001) operationalized <strong>scent</strong> as the cosine similarity between two word-frequency vectors: one representing the user's goal (derived from task descriptions) and one representing the link text (augmented by surrounding page text). They used <strong>spreading activation</strong> to propagate scent through the site's link graph, so that a link to a page with high-scent child pages would itself receive elevated scent. The model was validated against clickstream logs from Xerox's intranet and the Wharton School website, correctly predicting the top navigation path 40–60% of the time — far above the ~5% baseline of random selection among available links.</p>

<p>Spool et al. (2004) conducted <strong>usability testing</strong> with over 100 participants across 20+ websites. Each participant attempted specific information-finding tasks. The researchers coded link text quality on a scale and correlated it with task success rate. The correlation between link text quality and task success (r = 0.74) exceeded that of any other measured variable, including number of navigation levels, page length, or presence of search functionality. The finding was replicated across commercial, government, and educational sites.</p>

<p>An important boundary condition: Pirolli (2007) noted that information foraging theory applies most strongly to <strong>exploratory</strong> tasks (browsing, researching, comparing) where the user must navigate between patches. For <strong>known-item</strong> tasks (the user knows exactly what they want and where it is), direct navigation or search is used and foraging dynamics are less relevant.</p>

</details>

## Related Studies

**Pirolli (2007)** published *Information Foraging Theory: Adaptive Interaction with Information* (Oxford University Press), a book-length treatment consolidating a decade of research. He extended the theory to encompass not just web browsing but also email triage, document management, and intelligence analysis — any situation where a person must find relevant information among a large set of items.

**Fu & Pirolli (2007)** developed SNIF-ACT 2.0 (Scent-based Navigation and Information Foraging in the ACT architecture), a more refined computational model that could simulate user navigation through real websites. Given a goal description and a website's link structure, SNIF-ACT predicted click sequences that matched observed user behavior significantly better than competing models. The model has been used to evaluate website redesigns before deployment.

**Olston & Chi (2003)** studied **ScentTrails**, a system that visually highlighted high-scent links on a page based on the user's query. They found that users with ScentTrails completed information-finding tasks faster and with fewer navigation errors than users without it, directly demonstrating that amplifying scent improves foraging efficiency.

<details>
<summary>Deep Dive: Extended Literature</summary>

<p><strong>Satisficing and the web:</strong> Simon (1956) introduced satisficing — choosing the first option that meets a minimum threshold rather than optimizing — in the context of economic decision-making. Pirolli and Card (1999) adopted the concept to explain why users click the first reasonable search result rather than scanning the entire list. Eyetracking studies (Granka, Joachims & Gay, 2004) confirmed that users spend dramatically more time on the first few search results and rarely scroll past the first page, consistent with satisficing behavior.</p>

<p><strong>Pogosticking:</strong> The term was popularized by Spool et al. (2004) to describe the behavior of clicking a link, immediately returning to the previous page, clicking another link, returning again, and so on. Pogosticking indicates that the scent of the links is misleading — the link text promises one thing but the destination delivers another. Reducing pogosticking is one of the highest-leverage improvements a designer can make, as it directly reduces user frustration and time on task.</p>

<p><strong>Hub-and-spoke vs. tunnel navigation:</strong> Pirolli (2007) described two navigation patterns. Hub-and-spoke occurs when users return to a central page (like search results) between each foray — this indicates they are using the hub as an information patch and evaluating multiple trails. Tunnel navigation occurs when users follow a linear sequence of pages without returning — this indicates a strong, consistent scent trail. Designing for hub-and-spoke means making the hub page easy to return to and rich in scent cues; designing for tunnel navigation means ensuring each page in the sequence has a clear "next" action.</p>

<p><strong>Adaptive information foraging:</strong> Julien and Duggan (2000) studied how foraging strategies change with time pressure. Under time pressure, users become more selective (narrowing their "diet") and follow only the highest-scent links, skipping marginal options. This has implications for interfaces used in time-critical contexts (emergency dashboards, customer service portals): scent must be exceptionally clear because users will not explore ambiguous paths.</p>

</details>

## See Also

- [Recognition over Recall](../lessons/07-recognition-vs-recall.md) — information scent works because users recognize relevant cues rather than recalling where information might be
- [Heuristic Evaluation](../lessons/16-heuristic-evaluation.md) — several of Nielsen's heuristics (visibility of system status, match between system and real world) directly support strong information scent

## Try It

<details>
<summary>Exercise: Scent Audit of a Navigation Menu</summary>

<p>Select a website you use regularly (a documentation site, an e-commerce store, a SaaS product).</p>

<p><strong>Step 1:</strong> Pick a specific information goal. For example: "Find the return policy" or "Learn how to set up two-factor authentication."</p>

<p><strong>Step 2:</strong> Without using search, look at the main navigation menu and rate each menu item's <strong>scent</strong> on a 1–5 scale (1 = no indication this leads to my goal, 5 = strongly suggests my goal is here).</p>

<p><strong>Step 3:</strong> Click the highest-scent item. On the resulting page, rate the scent of each visible link or heading. Continue until you find the information or give up.</p>

<p><strong>Step 4:</strong> Record the number of clicks and any pogosticking (clicks followed by immediate back-navigation).</p>

<p><strong>Worked example:</strong> Goal: "Find how to cancel my subscription" on a SaaS product.</p>
<ul>
<li>Main navigation: "Home" (scent: 1), "Features" (1), "Pricing" (2), "Support" (3), "Account" (4). Click "Account."</li>
<li>Account page: "Profile" (1), "Billing" (4), "Team" (1), "Notifications" (1). Click "Billing."</li>
<li>Billing page: "Payment Method" (1), "Invoice History" (1), "Current Plan" (3), "Cancel Subscription" (5). Click "Cancel Subscription." Found in 3 clicks with no pogosticking.</li>
<li>Assessment: the scent trail was reasonably clear. If "Account" had been labeled "Settings" (scent: 2), the user might have tried "Support" first, adding a pogostick.</li>
</ul>

<p>This exercise trains you to evaluate scent from the user's perspective rather than the designer's — a critical skill because designers know where everything is and cannot naturally assess scent without deliberate effort.</p>

</details>
