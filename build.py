#!/usr/bin/env python3
"""Generates the static pages for liquid build. Run: python3 build.py"""
import os, html, json, re, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "public")
CO = json.load(open(os.path.join(ROOT, "data", "company.json")))
SITE = os.environ.get("SITE_URL", CO["url"]).rstrip("/")
PHONE = CO["phone"]
PHONE_TEL = CO["phoneE164"]
EMAIL = CO["email"]
AREA = CO["areaLine"]
TODAY = datetime.date.today().isoformat()
SERVICES = {s["slug"]: s for s in CO["services"]}

NAV = [
    ("home-development.html", "Home Development"),
    ("design-build.html", "Design-Build"),
    ("commercial.html", "Commercial"),
    ("schools.html", "Schools"),
    ("data-centers.html", "Data Centers"),
]

PROJECT_TYPES = [
    ("Renovation / remodel", "Kitchen, bath, whole home"),
    ("Addition / second story", "More room on the house you have"),
    ("New custom home", "On your lot, from the ground up"),
    ("Commercial build-out", "Restaurant, retail, office"),
    ("Land / home development", "Lots to a full community"),
    ("School / education", "Charter, private, campus"),
    ("Data center / industrial", "Power-first sites and shells"),
    ("Other", "Pool, windows, something else"),
]
INTENTS = [
    ("price", "I know what I want", "Price my project"),
    ("plans", "I have plans or photos", "Upload drawings, a survey or pictures"),
    ("design", "I have an idea", "Help me shape and design it"),
]
BUDGETS = ["Under $50k", "$50k to $150k", "$150k to $500k", "$500k to $2M", "$2M+", "Not sure yet"]
TIMELINES = ["As soon as possible", "1 to 3 months", "3 to 6 months", "6 to 12 months", "Just planning"]
IDEA_EXAMPLES = ["Add a second story with 2 bedrooms and a bath", "Turn my garage into an in-law suite", "Open the kitchen to the living room and add an island", "Build a 3,000 sq ft home on my lot in Davie", "Build out a 2,500 sq ft restaurant in Wynwood"]


LOGO_PATHS = ('M32 4 L60 26 V58 a4 4 0 0 1 -4 4 H8 a4 4 0 0 1 -4 -4 V26 Z', 'M29.29 52L27.16 52Q25.59 52 24.64 51.19Q23.70 50.38 23.70 48.60L23.70 32.83L27.16 32.83L27.16 48.25Q27.16 48.79 27.44 49.06Q27.72 49.33 28.24 49.33L29.29 49.33', 'M33.05 52.28Q31.99 52.28 31.17 51.71Q30.35 51.13 30.02 49.97Q29.70 48.81 30.10 47.07L33.57 32.16Q33.73 31.60 33.59 31.39Q33.45 31.17 33.01 31.14L32.08 31.04Q31.62 31.01 31.68 30.64Q31.74 30.36 32.12 30.30Q33.23 30.11 34.10 29.85Q34.97 29.59 35.49 29.15Q35.74 28.97 35.96 28.97Q36.33 28.97 36.24 29.43L33.42 41.62Q33.39 41.83 33.51 41.86Q33.63 41.89 33.73 41.71Q35.43 38.45 36.78 37.23Q38.13 36 39.31 36Q40.45 36 41.12 36.97Q41.79 37.93 41.79 39.79Q41.79 41.55 41.28 43.34Q40.76 45.12 39.88 46.73Q39 48.34 37.87 49.58Q36.73 50.82 35.49 51.55Q34.25 52.28 33.05 52.28M33.14 51.50Q33.94 51.50 34.84 50.78Q35.74 50.05 36.59 48.82Q37.45 47.60 38.13 46.06Q38.81 44.53 39.21 42.90Q39.62 41.27 39.62 39.76Q39.62 38.58 39.37 38.10Q39.12 37.62 38.50 37.62Q37.82 37.62 36.95 38.45Q36.08 39.29 35.18 40.67Q34.28 42.05 33.51 43.66Q32.73 45.27 32.27 46.84Q31.80 48.40 31.80 49.61Q31.80 51.50 33.14 51.50')


def logo(cls=""):
    h, l, b = LOGO_PATHS
    return (f'<span class="logo {cls}"><svg class="mark" viewBox="0 0 64 64" aria-hidden="true">'
            f'<path d="{h}" style="fill:var(--mh)"/><path d="{l}" style="fill:var(--ml)"/><path d="{b}" style="fill:var(--mb)"/></svg>'
            '<b>liquid</b><i>build</i></span>')


def header(active, over_photo):
    links = "".join(
        '<a href="/' + href + '"' + (' aria-current="page"' if href == active else '') + '>' + label + '</a>'
        for href, label in NAV
    )
    return f"""
<header class="site-header{' on-photo' if over_photo else ''}">
<div class="waitbar">Now taking waitlist requests. Construction contracts start once our contractor license transfer is complete. Need a permit now? <a href="https://liquidpermit.com/">Liquid Permit</a> can help today.</div>
  <div class="wrap bar">
    <a href="/" class="brand" aria-label="liquid build home">{logo()}</a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Open menu">
    <label for="nav-toggle" class="burger" aria-hidden="true"><span></span><span></span></label>
    <nav aria-label="Main">{links}<a href="#quote" class="pill">Join the waitlist</a></nav>
  </div>
</header>"""


def _chips(name, values, required=False):
    return "".join(
        f'<label class="chip"><input type="radio" name="{name}" value="{html.escape(v)}"{" required" if required and i == 0 else ""}><span>{html.escape(v)}</span></label>'
        for i, v in enumerate(values))


def quote_form(preset, headline="Let's <em>build.</em>", sub="Land, a lot or a lease: tell us what you have. We reply within one business day."):
    """Four short steps: what, where you're starting from, details (upload / idea / scope), contact.
    Without JavaScript every step shows at once and it posts like a normal form."""
    intent_preset = "design" if preset == "Design-build" else ""
    types = "".join(
        f'<label class="qcard"><input type="radio" name="project" value="{html.escape(t)}"{" checked" if t == preset else ""}{" required" if i == 0 else ""}>'
        f'<span><b>{html.escape(t)}</b><small>{html.escape(h)}</small></span></label>'
        for i, (t, h) in enumerate(PROJECT_TYPES))
    intents = "".join(
        f'<label class="qcard"><input type="radio" name="intent" value="{k}"{" checked" if k == intent_preset else ""}{" required" if i == 0 else ""}>'
        f'<span><b>{html.escape(t)}</b><small>{html.escape(h)}</small></span></label>'
        for i, (k, t, h) in enumerate(INTENTS))
    examples = "".join(f'<button type="button" class="ex" data-example>{html.escape(e)}</button>' for e in IDEA_EXAMPLES)
    return f"""
<section id="quote" class="quote wrap grid">
  <div class="quote-copy">
    <h2 class="display">{headline}</h2>
    <p class="muted lead">{sub}</p>
    <ol class="next-steps"><li>Tell us what you're building. Takes about a minute.</li><li>You're on the waitlist and get a text right away.</li><li>We call to plan it with you. Construction contracts start once our license transfer is complete.</li></ol>
    <p class="muted small">Need a permit sooner? <a href="https://liquidpermit.com/">Liquid Permit</a> can help now.</p>
    <p class="contact-lines"><a href="tel:{PHONE_TEL}">{PHONE}</a><br><a href="mailto:{EMAIL}">{EMAIL}</a><br><span class="muted">{AREA}</span></p>
  </div>
  <form class="quote-form qf" action="/api/quote" method="post" data-quote novalidate>
    <div class="qf-top" hidden><div class="qf-meta"><span class="qf-count" aria-live="polite">Step 1 of 4</span><span class="qf-picked" hidden></span></div><div class="qf-bar"><i></i></div></div>

    <fieldset class="qf-step" data-step="1">
      <legend>What are we building?</legend>
      <div class="qcards">{types}</div>
      <div class="qf-nav"><button type="button" class="btn dark" data-next>Next</button></div>
    </fieldset>

    <fieldset class="qf-step" data-step="2">
      <legend>Where are you starting from?</legend>
      <div class="qcards one">{intents}</div>
      <div class="qf-nav"><button type="button" class="qf-back" data-back>Back</button><button type="button" class="btn dark" data-next>Next</button></div>
    </fieldset>

    <fieldset class="qf-step" data-step="3">
      <legend>Tell us about it</legend>
      <div class="qf-when" data-when="plans">
        <div class="drop" data-drop tabindex="0" role="button" aria-label="Add files">
          <input type="file" data-file multiple accept="image/*,.heic,.pdf,.dwg,.dxf" hidden>
          <b>Drop plans, a survey or photos here</b>
          <span class="muted small">or tap to choose. PDF, JPG, PNG, HEIC, DWG. Up to 50 MB each.</span>
        </div>
        <ul class="files" data-files></ul>
        <p class="muted small" data-noupload hidden>Uploads aren't turned on yet. Send your request, then text the files to <a href="sms:{PHONE_TEL}">{PHONE}</a> or email <a href="mailto:{EMAIL}">{EMAIL}</a>.</p>
      </div>
      <div class="qf-when" data-when="design">
        <label>Describe the idea<textarea name="idea" rows="3" placeholder="In your own words. What you want, what you have now, what matters most."></textarea></label>
        <div class="examples"><span class="muted small">Need a start? Tap one:</span>{examples}</div>
        <button type="button" class="btn line" data-shape>Shape my idea</button>
        <div class="plan" data-plan aria-live="polite" hidden></div>
        <p class="muted small" data-open-chat-wrap>Rather talk it through? <a href="#" data-open-chat>Chat with our AI design assistant</a>. It can look at photos too.</p>
      </div>
      <div class="qf-when" data-when="price">
        <label>Size, if you know it<input name="size" type="text" inputmode="numeric" placeholder="Square feet, lots or megawatts"></label>
      </div>
      <label>Where is the project?<input name="location" type="text" placeholder="City or address" autocomplete="street-address"></label>
      <div class="field"><span class="flabel">Budget</span><div class="chips">{_chips("budget", BUDGETS)}</div></div>
      <div class="field"><span class="flabel">When do you want to start?</span><div class="chips">{_chips("timeline", TIMELINES)}</div></div>
      <label>Anything else? <span class="muted">(optional)</span><textarea name="details" rows="2" placeholder="Links, permits you have, deadlines, questions."></textarea></label>
      <div class="qf-nav"><button type="button" class="qf-back" data-back>Back</button><button type="button" class="btn dark" data-next>Next</button></div>
    </fieldset>

    <fieldset class="qf-step" data-step="4">
      <legend>Where should we send it?</legend>
      <label>Name<input name="name" type="text" autocomplete="name" required></label>
      <div class="row2">
        <label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>
        <label>Email <span class="muted">(optional)</span><input name="email" type="email" autocomplete="email"></label>
      </div>
      <div class="field"><span class="flabel">Best way to reach you</span><div class="chips">
        <label class="chip"><input type="radio" name="contact_pref" value="text" checked><span>Text</span></label>
        <label class="chip"><input type="radio" name="contact_pref" value="call"><span>Call</span></label>
        <label class="chip"><input type="radio" name="contact_pref" value="email"><span>Email</span></label></div></div>
      <label class="consent"><input type="checkbox" name="sms_consent" value="yes" checked> Text me about this request. Msg &amp; data rates may apply; reply STOP to opt out.</label>
      <label class="hp" aria-hidden="true">Company website<input name="company_website" type="text" tabindex="-1" autocomplete="off"></label>
      <input type="hidden" name="page" value="">
      <input type="hidden" name="files" value="">
      <input type="hidden" name="plan" value="">
      <div class="qf-nav"><button type="button" class="qf-back" data-back>Back</button><button type="submit" class="btn dark">Join the waitlist</button></div>
      <p class="form-status" role="status" aria-live="polite"></p>
    </fieldset>
    <div class="qf-done" data-done hidden tabindex="-1"></div>
  </form>
</section>"""


def footer():
    links = "".join(f'<a href="/{h}">{l}</a>' for h, l in NAV)
    return f"""
<footer class="site-footer">
  <div class="wrap foot">
    <div>{logo('dark')}<p class="muted">Liquid Build LLC · {AREA}</p><p class="muted license" data-license></p></div>
    <div class="foot-links">{links}<a href="/track-record">Track record</a></div>
    <div class="foot-links"><a href="/general-contractor-miami">Miami</a><a href="/general-contractor-fort-lauderdale">Fort Lauderdale</a><a href="/general-contractor-palm-beach">Palm Beach</a><a href="/es" hreflang="es">Español</a></div>
    <div class="foot-links"><a href="tel:{PHONE_TEL}">{PHONE}</a><a href="mailto:{EMAIL}">{EMAIL}</a><a href="/agents">For AI agents (MCP)</a><a href="/privacy">Privacy</a><a href="https://liquidpermit.com/">Liquid Permit</a><a href="https://www.liquid-labor.com/">Liquid Labor</a></div>
  </div>
</footer>"""


def org_ld():
    return {
        "@type": ["GeneralContractor", "HomeAndConstructionBusiness"],
        "@id": SITE + "/#org",
        "name": CO["name"], "legalName": CO["legalName"], "url": SITE + "/",
        "description": CO["description"], "slogan": CO["tagline"],
        "telephone": PHONE_TEL, "email": EMAIL,
        "image": SITE + "/images/dev-aerial.jpg", "logo": SITE + "/logo.png",
        "address": {"@type": "PostalAddress", "addressLocality": "Fort Lauderdale", "addressRegion": "FL", "addressCountry": "US"},
        "areaServed": [{"@type": "AdministrativeArea", "name": a} for a in CO["areaServed"]],
        "sameAs": CO["sameAs"],
        "knowsAbout": ["single-family community development", "design-build", "commercial build-outs", "school construction", "data center construction", "Florida Building Code", "High-Velocity Hurricane Zone"],
        "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Construction services", "itemListElement": [
            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": sv["name"], "url": SITE + "/" + sv["slug"]}} for sv in CO["services"]]},
        "potentialAction": {"@type": "CommunicateAction", "name": "Request a construction estimate", "target": SITE + "/#quote"},
    }


def ld_for(filename, title, desc):
    slug = filename[:-5]
    url = SITE + ("/" if slug == "index" else "/" + slug)
    graph = [org_ld(), {"@type": "WebPage", "@id": url, "url": url, "name": title, "description": desc,
                        "isPartOf": {"@id": SITE + "/#website"}, "about": {"@id": SITE + "/#org"}, "dateModified": TODAY}]
    if slug == "index":
        graph.append({"@type": "WebSite", "@id": SITE + "/#website", "url": SITE + "/", "name": CO["name"], "publisher": {"@id": SITE + "/#org"}})
        graph.append({"@type": "ItemList", "name": "Selected projects", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "item": {"@type": "CreativeWork", "name": p["name"], "description": p["type"] + ": " + p["detail"] + ", " + p["location"],
             **({"image": SITE + p["image"]} if p.get("image") else {})}} for i, p in enumerate(CO["projects"])]})
    if slug in SERVICES:
        sv = SERVICES[slug]
        graph.append({"@type": "Service", "name": sv["name"], "description": sv["summary"], "provider": {"@id": SITE + "/#org"},
                      "areaServed": CO["areaServed"][:3], "url": url})
        graph.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": sv["name"], "item": url}]})
    elif slug != "index":
        graph.append({"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": title.split(" | ")[0], "item": url}]})
    faqs = SERVICES[slug]["faqs"] if slug in SERVICES else (GENERAL_FAQS if slug == "index" else EXTRA_FAQS.get(slug, []))
    if faqs:
        graph.append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    return url, json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")


def faq_section(faqs, title="Questions, <em>answered</em>"):
    items = "".join(f'<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>' for q, a in faqs)
    return f'<section class="wrap section faq"><h2 class="display">{title}</h2><div class="faq-list">{items}</div></section>'


EXTRA_FAQS = {}

GENERAL_FAQS = [
    ("What does Liquid Build do?", CO["description"]),
    ("Where do you work?", "Miami-Dade, Broward and Palm Beach counties. That covers Miami, Fort Lauderdale, West Palm Beach and the towns in between, including Key Biscayne, Homestead and the Redland."),
    ("How fast do you reply to a quote request?", "Within one business day. Call or text " + PHONE + " for anything urgent."),
    ("Can my AI assistant get an estimate from you?", "Yes. Agents can connect to our MCP server at " + SITE + "/api/mcp for company info, ballpark estimates, project grounding and quote requests. See " + SITE + "/agents."),
]


def page(filename, title, desc, body, active="", over_photo=True, index=True, og="dev-aerial.jpg", lang="en", alternates=None, preload=None):
    url, ld = ld_for(filename, title, desc)
    alt_links = "".join(f'<link rel="alternate" hreflang="{hl}" href="{SITE}{p}">' for hl, p in (alternates or []))
    pre = f'<link rel="preload" as="image" href="/images/{preload}" fetchpriority="high">' if preload else ""
    robots = "index, follow, max-image-preview:large, max-snippet:-1" if index else "noindex, follow"
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
{pre}{alt_links}
<meta name="description" content="{html.escape(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Liquid Build">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{SITE}/images/{og}">
<meta property="og:image:alt" content="{html.escape(title)}">
<meta property="og:locale" content="{"es_US" if lang == "es" else "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{SITE}/images/{og}">
<meta name="geo.region" content="US-FL">
<meta name="geo.placename" content="Fort Lauderdale; Miami; West Palm Beach">
<link rel="alternate" type="text/plain" title="LLM summary" href="/llms.txt">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg?v=3" type="image/svg+xml">
<link rel="icon" href="/favicon.ico?v=3" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=3">
<script type="application/ld+json">{ld}</script>
</head>
<body>
{header(active, over_photo)}
<main>
{body}
</main>
{footer()}
<script src="/site.js" defer></script>
<script src="/chat.js" defer></script>
</body>
</html>"""


def hero(img, alt, h1, sub, cta="Join the waitlist", tall=False):
    return f"""
<section class="hero{' tall' if tall else ''}">
  <img src="/images/{img}" alt="{html.escape(alt)}" fetchpriority="high">
  <div class="scrim"></div>
  <div class="wrap hero-inner">
    <h1 class="display">{h1}</h1>
    <div class="hero-side">
      <p>{sub}</p>
      <a href="#quote" class="btn accent">{cta}</a>
    </div>
  </div>
</section>"""


def dark_hero(eyebrow, h1, sub):
    return f"""
<section class="hero dark-hero">
  <div class="wrap hero-inner">
    <div>
      <p class="eyebrow">{eyebrow}</p>
      <h1 class="display">{h1}</h1>
    </div>
    <div class="hero-side">
      <p>{sub}</p>
      <a href="#quote" class="btn accent">Talk to us</a>
    </div>
  </div>
</section>"""


def stats(items):
    cells = "".join(f'<div><div class="stat">{a}</div><div class="muted small">{b}</div></div>' for a, b in items)
    return f'<section class="stats"><div class="wrap stat-grid">{cells}</div></section>'


def fig(img, alt, name, meta, h=300):
    return f'<figure><img src="/images/{img}" alt="{html.escape(alt)}" loading="lazy" style="height:{h}px"><figcaption><b>{name}</b><span>{meta}</span></figcaption></figure>'


def list_block(title_html, rows, imgs):
    r = "".join(f'<div class="row"><span>{a}</span><span class="muted">{b}</span></div>' for a, b in rows)
    pics = "".join(f'<img src="/images/{i}" alt="{html.escape(a)}" loading="lazy">' for i, a in imgs)
    return f"""
<section class="band">
  <div class="wrap grid">
    <div class="band-copy"><h2 class="display">{title_html}</h2><div class="rows">{r}</div></div>
    <div class="band-pics">{pics}</div>
  </div>
</section>"""


def steps(title, items):
    s = "".join(f'<li><span class="num">{i+1}</span><b>{a}</b><p class="muted">{b}</p></li>' for i, (a, b) in enumerate(items))
    return f'<section class="wrap section"><h2 class="display">{title}</h2><ol class="steps">{s}</ol></section>'


def cards(title, items, note=""):
    c = "".join(f'<div class="card"><b>{a}</b><p class="muted">{b}</p></div>' for a, b in items)
    n = f'<p class="muted small note">{note}</p>' if note else ""
    return f'<section class="wrap section"><h2 class="display">{title}</h2><div class="cards">{c}</div>{n}</section>'


COMMUNITIES = f"""
<section class="wrap section">
  <div class="section-head"><h2 class="display">Communities</h2><p class="muted">Built by our team at Shores Development, a Miami-Dade home developer since 1950</p></div>
  <figure class="wide-fig"><img src="/images/redland-aerial.jpg" alt="Aerial view of Redland Ranches: large single-family homes on acre lots" loading="lazy"><figcaption><b>Redland Ranches from the air</b><span>140 lots, 84+ homes built · Redland, Miami-Dade</span></figcaption></figure>
  <div class="grid3 comm-grid">
    {fig('redland-renoir-home.jpg','Finished Renoir model home at Redland Ranches with three-car garage','Redland Ranches','140 lots · pools standard',300)}
    {fig('las-palmas.jpg','Finished single-story Las Palmas home with tile roof and wood fence','Las Palmas','19 homes · sold out',300)}
    {fig('toscana.jpg','Rendering of a one-story Toscana Estates home with a three-car garage','Toscana Estates','24 homes · sold out',300)}
  </div>
  <div class="models">
    <h3>Models we built</h3>
    <table>
      <thead><tr><th>Community</th><th>Models</th><th>Size (A/C sq ft)</th><th>Bed / bath / garage</th></tr></thead>
      <tbody>
        <tr><td>Redland Ranches</td><td>Renoir, Van Gogh</td><td>2,901 to 3,606</td><td>5 to 6 / 3 to 4 / 3</td></tr>
        <tr><td>Las Palmas</td><td>Sable Palm, Silver Palm, Royal Palm</td><td>2,400 to 3,606</td><td>4 to 6 / 3 to 4 / 2 or 3</td></tr>
        <tr><td>Toscana Estates</td><td>Picasso, Renoir</td><td>2,400 to 2,701</td><td>4 to 5 / 3 / 2 or 3</td></tr>
        <tr><td>Casa Bella</td><td>Gardenia, Orchid, Hibiscus (twin and single-family homes)</td><td>1,708 to 2,766</td><td>3 to 4 / 2.5 to 3 / 1 or 2</td></tr>
      </tbody>
    </table>
    <p class="muted small">Also: Estate Mansions and the Villa Harbour waterfront renovation. Commercial: a 5-acre mixed-use site in Palmetto Bay.</p>
  </div>
</section>"""

INSIDE = f"""
<section class="wrap section">
  <div class="section-head"><h2 class="display">Inside a <em>Redland Ranches</em> home</h2><p class="muted">Renoir model: 5 bedrooms, 3 baths, 3-car garage, pool</p></div>
  <div class="inside">
    <img class="in-big" src="/images/redland-pool-waterfall.jpg" alt="Backyard pool with waterfall spillway and palm trees" loading="lazy">
    <img src="/images/redland-kitchen.jpg" alt="Open kitchen with dark cabinets, white quartz island and mosaic backsplash" loading="lazy">
    <img src="/images/redland-living.jpg" alt="Open living room with tile floors and glass doors to the backyard" loading="lazy">
    <img src="/images/redland-bath.jpg" alt="Primary bath with freestanding tub and glass shower" loading="lazy">
    <img src="/images/redland-lanai.jpg" alt="Covered lanai looking out to the pool" loading="lazy">
  </div>
</section>"""

COMMERCIAL_GRID = f"""
<section class="wrap section">
  <h2 class="display">Commercial &amp; <em>institutional</em></h2>
  <div class="grid3">
    {fig('albizu-university.jpg','Carlos Albizu University campus building in Miami','Carlos Albizu University','Second-floor remodel · Miami')}
    {fig('chilis-fiu.jpg',"Finished circular bar inside a Chili's restaurant","Chili's","FIU Graham Center, Miami")}
    {fig('starbucks-buildout.jpg','Crew installing millwork at a Starbucks counter','Starbucks','Build-out · Miami')}
    {fig('restaurant-counter.jpg','Finished quick-service restaurant counter with menu boards','Quick-service restaurant','Build-out')}
    {fig('oasis-key-biscayne.jpg','Renovated Oasis storefront in Key Biscayne','Oasis','Retail renovation · Key Biscayne')}
    {fig('interior-buildout.jpg','Commercial interior under construction with new ceiling lighting','Commercial interior','Tenant build-out')}
  </div>
</section>"""

CUSTOM_HOMES = f"""
<section class="wrap section">
  <h2 class="display">Custom <em>homes</em></h2>
  <div class="grid3">
    {fig('home-key-biscayne.jpg','Two-story custom home with white balconies in Key Biscayne','Custom residence','New construction · Key Biscayne',360)}
    {fig('home-finished.jpg','Renovated single-story home with palm trees and new landscaping','Residence · Miami','Full renovation',360)}
    {fig('pool-aerial.jpg','Aerial view of a new pool and spa with paver deck','Pool &amp; spa','New construction',360)}
  </div>
</section>"""

SECTORS = """
<section class="wrap section">
  <h2 class="display">What we <em>build</em></h2>
  <div class="sectors">
    <a href="/home-development.html"><b>Home Development</b><span>Land to finished communities</span></a>
    <a href="/design-build.html"><b>Design-Build</b><span>One contract, one team</span></a>
    <a href="/commercial.html"><b>Commercial</b><span>Restaurant &amp; retail build-outs</span></a>
    <a href="/schools.html"><b>Schools</b><span>Charter, private &amp; higher-ed</span></a>
    <a href="/data-centers.html"><b>Data Centers</b><span>Power-first sites &amp; shells</span></a>
  </div>
</section>"""

AI_SECTION = """
<section class="wrap section">
  <div class="section-head"><h2 class="display">An AI-powered <em>general contractor</em></h2><p class="muted">AI does the busywork. Experienced builders make the calls.</p></div>
  <div class="cards">
    <div class="card"><b>Ballpark in minutes</b><p class="muted">Get a rough cost range right now, on this page or through your AI assistant. A real bid follows a site visit.</p></div>
    <div class="card"><b>Every lead answered</b><p class="muted">Every request is logged, confirmed by text right away and answered within one business day.</p></div>
    <div class="card"><b>Permits that keep moving</b><p class="muted">Permits and approvals run through Liquid Permit, so nothing sits in a queue unnoticed.</p></div>
    <div class="card"><b>Works with your AI</b><p class="muted">Claude, ChatGPT and other assistants can talk to us directly to plan a project or request a quote. <a href="/agents">How it works</a></p></div>
  </div>
</section>"""

EST_TYPES = [("new_custom_home", "New custom home", "sq ft"), ("addition", "Home addition", "sq ft"), ("whole_home_renovation", "Whole-home renovation", "sq ft"),
             ("kitchen_remodel", "Kitchen remodel", ""), ("bathroom_remodel", "Bathroom remodel", ""), ("pool", "Pool and spa", ""),
             ("impact_windows_doors", "Impact windows and doors", ""), ("restaurant_buildout", "Restaurant build-out", "sq ft"),
             ("retail_office_ti", "Retail or office build-out", "sq ft"), ("school_renovation", "School renovation", "sq ft"),
             ("new_school", "New school building", "sq ft"), ("warehouse_industrial", "Warehouse or industrial", "sq ft"),
             ("data_center", "Data center", "MW"), ("community_sitework", "Community sitework", "lots")]
est_opts = "".join(f'<option value="{k}" data-unit="{u}">{l}</option>' for k, l, u in EST_TYPES)
ESTIMATOR = f"""
<section class="wrap section" id="estimate">
  <div class="estimator">
    <div><h2 class="display">Get a <em>ballpark</em> now</h2><p class="muted">A rough range for planning. Not a bid.</p></div>
    <form class="est-form" data-estimate>
      <label>Project<select name="project_type">{est_opts}</select></label>
      <label data-size><span>Size <span data-unit>(sq ft)</span></span><input name="size" type="number" min="1" inputmode="numeric" placeholder="2,500"></label>
      <label>Finish<select name="finish"><option value="standard">Standard</option><option value="mid" selected>Mid-range</option><option value="high">High-end</option></select></label>
      <label>City<input name="location" type="text" placeholder="Fort Lauderdale"></label>
      <button class="btn accent" type="submit">Estimate</button>
    </form>
    <div class="est-result" data-est-result aria-live="polite"></div>
  </div>
</section>"""

pages = {}

pages["index.html"] = page(
    "index.html",
    "Liquid Build | South Florida's AI-Powered Builder & Developer",
    "AI-powered general contractor and developer in South Florida. Communities, custom homes, commercial, schools and data centers. 10,000+ homes since 1950.",
    hero("dev-aerial.jpg", "Aerial view of a new single-family community under construction", "The AI-powered<br><em>general contractor.</em>",
         "Ballparks in seconds, an AI design assistant and a spot on our build waitlist, backed by a South Florida team that has built here since 1950. Homes, communities, commercial, schools and data centers.", tall=True)
    + stats([("300+", "homes &amp; condo units developed"), ("1950", "Shores Development founded"), ("Land → Keys", "sitework, vertical, finishes"), ("AI-powered", "estimating, follow-up and permits")])
    + AI_SECTION + ESTIMATOR + SECTORS + COMMUNITIES + INSIDE + CUSTOM_HOMES + COMMERCIAL_GRID
    + faq_section(GENERAL_FAQS)
    + quote_form(""),
    alternates=[("en", "/"), ("es", "/es"), ("x-default", "/")], preload="dev-aerial.jpg",
)

pages["home-development.html"] = page(
    "home-development.html",
    "Home Development in South Florida | Liquid Build",
    "Single-family communities from raw land to keys in Miami-Dade, Broward and Palm Beach. Redland Ranches, Toscana Estates, Las Palmas. Since 1950.",
    hero("redland-renoir-home.jpg", "Finished Renoir model home at Redland Ranches", "Home<br><em>development.</em>",
         "Raw land in, finished streets out. We take single-family communities from entitlements to closings.")
    + stats([("140", "lots · Redland Ranches"), ("24", "homes · Toscana"), ("19", "units · Las Palmas"), ("300+", "units developed by our team")])
    + steps("Land to keys", [
        ("Land & feasibility", "Site due diligence, yield studies, budget and schedule before you close."),
        ("Entitlements & permits", "Plats, zoning and building permits, coordinated with Liquid Permit."),
        ("Sitework", "Clearing, fill, roads, drainage, water and sewer."),
        ("Vertical", "Model homes first, then production building lot by lot."),
    ])
    + COMMUNITIES
    + INSIDE
    + faq_section(SERVICES["home-development"]["faqs"])
    + quote_form("Land / home development", "Have land?<br><em>Let's plan it.</em>"),
    "home-development.html",
)

pages["design-build.html"] = page(
    "design-build.html",
    "Design-Build Contractor in South Florida | Liquid Build",
    "One contract, one team: design, permits and construction for homes, commercial interiors, schools and industrial buildings in South Florida.",
    hero("pool-aerial.jpg", "Aerial view of a new pool and spa with paver deck", "Design-<em>build.</em>",
         "One contract and one team from first sketch to final inspection. Price and schedule are set early and stay put.")
    + cards("Why <em>design-build</em>", [
        ("One point of contact", "Design, engineering, permits and construction run through one team."),
        ("Price early", "Budget is set during design, not after bids come back high."),
        ("Faster start", "Permits and early site work move while drawings are finished."),
        ("Fewer change orders", "The people drawing it are the people building it."),
    ])
    + """
<section class="wrap ai-band" data-open-chat-wrap>
  <div><h2 class="display">Sketch it with <em>AI</em> first.</h2>
  <p class="muted lead">Describe the project or send a photo of the space. Our design assistant suggests layouts and finishes, gives a ballpark, and sends it to the team when you're ready.</p></div>
  <div class="ai-band-cta"><a href="#quote" class="btn accent" data-open-chat>Open the design assistant</a><a href="#quote" class="qf-back">or fill out the quote form</a></div>
</section>"""
    + steps("How it works", [
        ("Program", "What you need, where, and for how much."),
        ("Design", "Architects and engineers draw to the budget."),
        ("Permit", "Plans submitted and tracked with Liquid Permit."),
        ("Build", "Our crews build it, then hand you the keys."),
    ])
    + list_block("We design-build", [("Custom homes", "New builds, additions, pools"), ("Commercial", "Restaurant &amp; retail"), ("Schools", "Classrooms, campuses"), ("Industrial", "Warehouses, data centers")],
                 [("new-home-pool.jpg", "New home under construction with pool forms"), ("team-on-site.jpg", "Project team reviewing plans on site")])
    + CUSTOM_HOMES
    + faq_section(SERVICES["design-build"]["faqs"])
    + quote_form("Design-build", "Start with<br><em>a sketch.</em>"),
    "design-build.html",
)

pages["commercial.html"] = page(
    "commercial.html",
    "Restaurant & Retail Build-Outs in Miami | Liquid Build",
    "Restaurant, retail and office build-outs in South Florida: Chili's at FIU, Starbucks, Carlos Albizu University. Built to brand spec and opening day.",
    hero("chilis-fiu.jpg", "Finished circular bar inside a Chili's restaurant at FIU", "Commercial<br><em>build-outs.</em>",
         "Restaurant and retail interiors built to the brand's spec and ready by opening day.")
    + COMMERCIAL_GRID
    + list_block("What we <em>deliver</em>", [("Restaurants", "Kitchens, bars, dining rooms"), ("Retail", "Storefronts &amp; interiors"), ("Offices", "Tenant improvements"), ("Hospitality", "Renovations while open")],
                 [("interior-buildout.jpg", "Commercial interior under construction with new ceiling lighting"), ("starbucks-buildout.jpg", "Crew installing millwork at a Starbucks counter")])
    + faq_section(SERVICES["commercial"]["faqs"])
    + quote_form("Commercial build-out", "Opening date?<br><em>We plan around it.</em>"),
    "commercial.html",
)

pages["schools.html"] = page(
    "schools.html",
    "School & Campus Construction in South Florida | Liquid Build",
    "School and campus construction in South Florida, phased around the school calendar. Recent work: Carlos Albizu University and FIU Graham Center.",
    hero("albizu-university.jpg", "Carlos Albizu University campus building in Miami", "Schools &amp;<br><em>campuses.</em>",
         "New classrooms, renovations and campus work, scheduled around the school calendar so students never miss a day.")
    + cards("What we <em>build</em>", [
        ("Charter &amp; private schools", "New buildings, conversions and additions."),
        ("Higher education", "Floor remodels, labs, food service and student spaces."),
        ("Summer renovations", "Work phased to finish before the first bell."),
        ("Safety &amp; hardening", "Impact windows, secure entries, fire and life safety."),
    ])
    + f"""
<section class="wrap section">
  <h2 class="display">Recent <em>campus work</em></h2>
  <div class="mosaic">
    <div class="m-big">{fig('albizu-university.jpg','Carlos Albizu University campus building in Miami','Carlos Albizu University · Miami','Second-floor remodel',460)}</div>
    <div class="m-stack">
      {fig('chilis-fiu.jpg',"Finished circular bar inside a Chili's at FIU's Graham Center","FIU Graham Center · Miami","Chili's build-out",220)}
      {fig('starbucks-buildout.jpg','Crew installing millwork at a Starbucks counter','Starbucks · Miami','Build-out',220)}
    </div>
  </div>
</section>"""
    + steps("Built around the calendar", [
        ("Walkthrough", "We tour the campus and map what can't be disrupted."),
        ("Phase plan", "Work split into windows: nights, weekends and summers."),
        ("Permit", "Plans filed and tracked with Liquid Permit."),
        ("Build &amp; hand over", "Rooms ready, inspected and clean before class."),
    ])
    + faq_section(SERVICES["schools"]["faqs"])
    + quote_form("School / education", "Next school year?<br><em>Start now.</em>"),
    "schools.html",
)

pages["data-centers.html"] = page(
    "data-centers.html",
    "Data Center Construction in Florida | Liquid Build",
    "Power-first data center builder in Florida: site and power checks, sitework, shell and core, and electrical coordination to energize on schedule.",
    hero("data-center-aisle.jpg", "Long aisle of electrical switchgear cabinets (stock photo)", "Power first.<br><em>Built fast.</em>",
         "The constraint is megawatts, not square feet. We plan sites around power and build the shell, pads and infrastructure to energize on schedule.", cta="Talk to us")
    + cards("What we <em>deliver</em>", [
        ("Site &amp; power diligence", "Utility capacity, interconnection timeline, flood and zoning checks before you buy."),
        ("Sitework", "Grading, pads, duct banks, drainage and access roads."),
        ("Shell &amp; core", "Tilt-up and pre-engineered structures ready for fit-out."),
        ("Electrical &amp; mechanical coordination", "Switchgear, generator yards and cooling plant, coordinated with your engineers."),
        ("Modular &amp; edge", "Prefabricated modules and small edge sites."),
        ("Permits", "Local and state approvals tracked with Liquid Permit."),
    ])
    + steps("From land to energized", [
        ("Find power", "Screen sites by available megawatts and time to energize."),
        ("Lock the site", "Due diligence, entitlements and utility agreements."),
        ("Build", "Sitework, pads, shell and infrastructure in parallel."),
        ("Energize", "Commissioning support and handover to operations."),
    ])
    + f'<section class="wrap section callout"><p>Tracking the U.S. data center build-out: <a href="https://www.liquid-labor.com/tracker/">Liquid Labor project tracker →</a></p></section>'
    + faq_section(SERVICES["data-centers"]["faqs"])
    + quote_form("Data center / industrial", "Have a site<br><em>or a load?</em>", "Send the location and the megawatts you need. We reply within one business day."),
    "data-centers.html", og="data-center-aisle.jpg", preload="data-center-aisle.jpg",
)

pages["thanks.html"] = page(
    "thanks.html",
    "Thanks | Liquid Build",
    "Your request was sent.",
    f'<section class="wrap section thanks"><h1 class="display">Got it. <em>Talk soon.</em></h1><p class="lead muted">We reply within one business day. Need us sooner? Call <a href="tel:{PHONE_TEL}">{PHONE}</a>.</p><p><a class="btn dark" href="/">Back to home</a></p></section>',
    over_photo=False, index=False,
)

pages["404.html"] = page(
    "404.html", "Not found | Liquid Build", "Page not found.",
    '<section class="wrap section thanks"><h1 class="display">Nothing <em>built here.</em></h1><p><a class="btn dark" href="/">Back to home</a></p></section>',
    over_photo=False, index=False,
)


pages["privacy.html"] = page(
    "privacy.html",
    "Privacy Policy | Liquid Build",
    "How Liquid Build collects, uses and protects information from our website, quote forms, text messages and MCP server for AI assistants.",
    f"""
<section class="wrap section legal">
  <h1 class="display">Privacy <em>policy</em></h1>
  <p class="muted">Last updated {TODAY}. Liquid Build LLC ("we") runs this website, our quote forms, our text messaging and our MCP server for AI assistants.</p>
  <h2>What we collect</h2>
  <ul>
    <li><b>What you send us:</b> your name, phone, email, project type, location, budget, timeline, project details and any plans or photos, from our forms, by text, by email, or through an AI assistant using our <code>request_quote</code> tool.</li>
    <li><b>Estimate requests:</b> the project type, size, finish level and city you enter in the ballpark estimator or send to our MCP tools. These are not stored with your name.</li>
    <li><b>Technical data:</b> your IP address and browser or client name, used to stop spam and abuse.</li>
  </ul>
  <h2>How we use it</h2>
  <ul>
    <li>To reply to you, prepare estimates and bids, and run your project.</li>
    <li>To send you texts about your request, only if you agreed. Reply STOP to opt out at any time.</li>
    <li>We do not sell your information and we do not use it for third-party advertising.</li>
  </ul>
  <h2>Who helps us</h2>
  <p>We use service providers to run the site and talk with you: Vercel (hosting and file storage), Neon (database), Twilio (text messages), Resend and FormSubmit (email), and Anthropic (the AI model behind our design assistant). They process data only to provide those services.</p>
  <h2>AI assistants and our MCP server</h2>
  <p>Our MCP server at <code>{SITE}/api/mcp</code> does not require an account. Estimate and planning tools do not store personal information. When an assistant calls <code>request_quote</code>, the name, contact details and project description it sends are saved as a quote request, the same as our website form. We do not receive your conversation with the assistant beyond what the tool call contains.</p>
  <h2>Our AI design assistant and file uploads</h2>
  <p>When you use the design assistant chat on this site, the messages and photos you send are processed by Anthropic's Claude API to write replies. We don't save the chat unless you ask us to send your request to our team; then the summary, your contact details and any photos are saved with your quote request. Plans and photos you upload on the quote form are stored privately and only our team can open them.</p>
  <h2>How long we keep it</h2>
  <p>We keep quote requests and project records as long as needed to respond, do the work and meet legal and warranty obligations. Ask us to delete your information at any time.</p>
  <h2>Your choices</h2>
  <p>To see, correct or delete your information, or to stop texts or emails, contact us at <a href="mailto:{EMAIL}">{EMAIL}</a> or {PHONE}.</p>
  <h2>Contact</h2>
  <p>Liquid Build LLC · {AREA} · <a href="mailto:{EMAIL}">{EMAIL}</a> · {PHONE}</p>
</section>""",
    over_photo=False,
)

# ================= Track record =================
LAND = [("Tamiami Airport", "673 single-family lots", "Lennar Homes"), ("Doral Landings", "918 lots", "Lennar Homes"),
        ("Doral 58th Street", "751 lots", "Lennar Homes"), ("Suchman Property", "692 single-family lots", "Poinciana Homes, United Homes"),
        ("Eureka Villas", "667 single-family lots", "Landstar Homes, Hamlet Development, Precious Homes"), ("Spanish Lakes", "525 single-family lots", "Lennar Homes"),
        ("Keys Gate I", "515 condominiums", "Centergate Construction"), ("Keys Gate III", "856 acres, 506 lots", "Westbrooke, South Kendall Construction, Pride Homes, Shoma Homes"),
        ("Woodfield Estates", "450 lots: water, sewer, paving, drainage, roads", "Shores development"), ("360 Developers (with Lennar)", "414 condominiums", "Joint venture"),
        ("Poinciana Homes joint venture", "401 lots", "F&H Builders, Poinciana Homes, Monaco Builders"), ("Keys Gate II", "217 lots", "South Kendall Construction"),
        ("Milton Property", "108 acres", "Lennar Homes, Caribe Homes"), ("Impression Gardens / Tropical Gardens", "108 acres", "Lennar Homes, Caribe Homes, Pride Homes")]
BUILT = [("Oak Lake Homes", "110"), ("Xpandia Homes", "109"), ("Lakeside at the Hammocks", "91"), ("Redland Ranches", "84+ (140 lots)"),
         ("Oakwood at the Hammocks", "75"), ("Oakwood Estates", "50"), ("Kendall Hammock Oaks", "31"), ("Shoreline at the Hammocks", "30")]
land_rows = "".join(f"<tr><td>{a}</td><td>{s}</td><td>{c}</td></tr>" for a, s, c in LAND)
built_rows = "".join(f"<tr><td>{a}</td><td>{n}</td></tr>" for a, n in BUILT)
EXTRA_FAQS["track-record"] = [
    ("Who is behind Liquid Build?", "The team comes from Shores Development, a Miami-Dade home developer founded in 1950 by Sam Rosen, and from Selenis Construction. Shores and its principals have developed, built and sold more than 10,000 single-family and condo units in South Florida."),
    ("Which builders bought Shores Development land?", "Finished lots and parcels went to Lennar Homes, Landstar, Poinciana Homes, Pride Homes, Shoma Homes, Caribe Homes and others, across Doral, Kendall, Homestead and Broward County."),
]
pages["track-record.html"] = page(
    "track-record.html",
    "Track Record: 10,000+ Homes Since 1950 | Liquid Build",
    "The team behind Liquid Build: Shores Development, founded 1950. 10,000+ homes and condos, 5,800+ lots sold to Lennar and others, plus commercial work.",
    hero("redland-estate-home.jpg", "Finished estate home at Redland Ranches with a long paver driveway", "Since 1950.<br><em>10,000+ homes.</em>",
         "The team behind Liquid Build comes from Shores Development, a Miami-Dade home developer founded in 1950, and Selenis Construction.")
    + stats([("1950", "Shores Development founded"), ("10,000+", "homes and condos developed, built and sold"), ("5,800+", "lots developed in South Florida"), ("3", "counties: Miami-Dade, Broward, Palm Beach")])
    + f"""
<section class="wrap section">
  <div class="section-head"><h2 class="display">Land <em>development</em></h2><p class="muted">Raw land turned into finished lots, then sold to national builders. 1979 to 2012.</p></div>
  <div class="models"><table><thead><tr><th>Project (Miami-Dade)</th><th>Size</th><th>Sold to</th></tr></thead><tbody>{land_rows}</tbody></table>
  <p class="muted small">With Lennar in Broward and Miami-Dade: Emerald Isles, Trail Walk and Courts of Tuscany, Paloma Lakes, Palm Aire Estates, Isles of Oakland Park, The Preserve at Coconut Creek, Silver Palm Holdings of Homestead, Doral Gardens, The Enclave at Doral and The Palms at Doral.</p></div>
</section>
<section class="wrap section">
  <div class="grid two-col">
    <div class="models"><h3>Homes we built</h3><table><thead><tr><th>Community (Miami-Dade)</th><th>Homes</th></tr></thead><tbody>{built_rows}</tbody></table></div>
    <div class="models"><h3>Commercial and industrial</h3><table><thead><tr><th>Project</th><th>Role</th></tr></thead><tbody>
      <tr><td>Espressway Industrial Park, Miami-Dade</td><td>Developer</td></tr>
      <tr><td>Shores Supply Warehouse, Miami-Dade</td><td>General contractor</td></tr>
      <tr><td>Wild Lime Park, Miami-Dade</td><td>General contractor</td></tr>
      <tr><td>Goodyear Service Center, Largo</td><td>Developer and builder</td></tr>
      <tr><td>Percon Construction, Palm Beach</td><td>Shell contractor</td></tr>
      <tr><td>Carlos Albizu University, Miami</td><td>Second-floor remodel</td></tr>
      <tr><td>Chili's, FIU Graham Center</td><td>Restaurant build-out</td></tr>
    </tbody></table></div>
  </div>
</section>"""
    + faq_section(EXTRA_FAQS["track-record"])
    + quote_form("Land / home development", "Put 75 years<br><em>to work.</em>"),
    "", og="redland-estate-home.jpg",
)

# ================= City pages =================
def city_page(slug, city, county, h1, lead, local_html, img, alt, faqs):
    EXTRA_FAQS[slug] = faqs
    return page(
        slug + ".html",
        f"General Contractor in {city}, FL | Liquid Build",
        f"AI-powered general contractor in {city}, {county}: new homes, additions, commercial build-outs, schools and data centers. Call 305-833-5025.",
        hero(img, alt, h1, lead)
        + local_html
        + SECTORS
        + faq_section(faqs)
        + quote_form("New custom home", f"Building in<br><em>{city}?</em>"),
        "", og=img,
    )

MIAMI_LOCAL = """
<section class="wrap section">
  <h2 class="display">Built in <em>Miami-Dade</em></h2>
  <div class="cards">
    <div class="card"><b>Redland and Homestead</b><p class="muted">Redland Ranches, Las Palmas, Toscana Estates and Casa Bella: single-family communities from raw land to keys.</p></div>
    <div class="card"><b>Doral, Kendall and Tamiami</b><p class="muted">Thousands of finished lots developed and sold to Lennar and other builders, plus homes built at the Hammocks and Oak Lake.</p></div>
    <div class="card"><b>Campus and commercial</b><p class="muted">Carlos Albizu University, Chili's at FIU's Graham Center, Starbucks and Oasis in Key Biscayne.</p></div>
    <div class="card"><b>Hurricane code</b><p class="muted">Miami-Dade is in the High-Velocity Hurricane Zone. We spec HVHZ-approved windows, doors and roofing from the start.</p></div>
  </div>
</section>"""
FTL_LOCAL = """
<section class="wrap section">
  <h2 class="display">Built in <em>Broward</em></h2>
  <div class="cards">
    <div class="card"><b>Home base</b><p class="muted">Liquid Build is based in Fort Lauderdale, a short drive from job sites across Broward County.</p></div>
    <div class="card"><b>Broward communities</b><p class="muted">Our team developed land for Lennar communities including Emerald Isles, Paloma Lakes, Palm Aire Estates, Isles of Oakland Park and The Preserve at Coconut Creek.</p></div>
    <div class="card"><b>Hurricane code</b><p class="muted">Broward is in the High-Velocity Hurricane Zone, like Miami-Dade. Windows, doors and roofing need HVHZ-rated products.</p></div>
    <div class="card"><b>Flood zones</b><p class="muted">Much of coastal Broward is in a FEMA flood zone. We check elevation rules before design so the budget holds.</p></div>
  </div>
</section>"""
PB_LOCAL = """
<section class="wrap section">
  <h2 class="display">Built in <em>Palm Beach</em></h2>
  <div class="cards">
    <div class="card"><b>Industrial and data centers</b><p class="muted">Palm Beach County has land and power for industrial and data center projects. We screen sites by megawatts and time to energize.</p></div>
    <div class="card"><b>Shell construction</b><p class="muted">Our team has worked as shell contractor in Palm Beach and as developer and builder on industrial parks in South Florida.</p></div>
    <div class="card"><b>Custom homes and additions</b><p class="muted">New homes, additions and pools from Boca Raton to Jupiter, with design-build pricing set early.</p></div>
    <div class="card"><b>Wind code</b><p class="muted">Palm Beach is outside the HVHZ but is a wind-borne debris region: openings need impact-rated products or approved shutters.</p></div>
  </div>
</section>"""
pages["general-contractor-miami.html"] = city_page("general-contractor-miami", "Miami", "Miami-Dade County",
    "General contractor<br><em>in Miami.</em>", "New homes, communities, commercial build-outs and campus work across Miami-Dade, from Doral to the Redland.",
    MIAMI_LOCAL, "redland-renoir-home.jpg", "Finished Renoir model home at Redland Ranches in Miami-Dade",
    [("Do you build in Homestead and the Redland?", "Yes. Our team built Redland Ranches, Las Palmas, Toscana Estates and Casa Bella in south Miami-Dade."),
     ("Do Miami-Dade projects need special windows and roofing?", "Yes. Miami-Dade is in the High-Velocity Hurricane Zone, so windows, doors and roofing need HVHZ-approved products such as those with a Miami-Dade NOA."),
     ("Can I get a price before a site visit?", "Yes. Use the ballpark estimator on our home page or ask your AI assistant through our MCP server. A real bid follows a site visit.")])
pages["general-contractor-fort-lauderdale.html"] = city_page("general-contractor-fort-lauderdale", "Fort Lauderdale", "Broward County",
    "General contractor<br><em>in Fort Lauderdale.</em>", "Based in Fort Lauderdale. New homes, additions, restaurant build-outs and development across Broward County.",
    FTL_LOCAL, "redland-3car-home.jpg", "Single-family home with three-car garage built by our team",
    [("Are you based in Fort Lauderdale?", "Yes. Liquid Build is based in Fort Lauderdale and works across Broward, Miami-Dade and Palm Beach."),
     ("Is Broward in the hurricane zone?", "Yes. Broward and Miami-Dade are both in the High-Velocity Hurricane Zone, which sets stricter rules for windows, doors and roofing."),
     ("Do you handle permits in Broward?", "Yes. Permits and approvals are coordinated with our sister company Liquid Permit.")])
pages["general-contractor-palm-beach.html"] = city_page("general-contractor-palm-beach", "Palm Beach", "Palm Beach County",
    "General contractor<br><em>in Palm Beach.</em>", "Industrial sites, data centers, custom homes and additions across Palm Beach County.",
    PB_LOCAL, "data-center-aisle.jpg", "Long aisle of electrical switchgear cabinets (stock photo)",
    [("Do you build data centers in Palm Beach County?", "Yes. We handle site and power diligence, sitework, shell and core, and electrical and mechanical coordination with your engineers."),
     ("Is Palm Beach in the High-Velocity Hurricane Zone?", "No. The HVHZ covers Miami-Dade and Broward. Palm Beach is a wind-borne debris region, so openings still need impact protection."),
     ("Do you build homes in Boca Raton and Jupiter?", "Yes. New custom homes, additions and pools across Palm Beach County.")])

# ================= Spanish page =================
ES_FAQS = [("¿Dónde trabajan?", "En los condados de Miami-Dade, Broward y Palm Beach: Miami, Fort Lauderdale, West Palm Beach y todas las ciudades entre ellas."),
           ("¿Cuánto tardan en responder?", "Respondemos en un día hábil. Para algo urgente, llame o envíe un texto al " + PHONE + "."),
           ("¿Hablan español?", "Sí. Puede escribirnos o llamarnos en español.")]
EXTRA_FAQS["es"] = ES_FAQS
es_opts = "".join(f"<option>{o}</option>" for o in ["Desarrollo de terreno / comunidad", "Casa nueva", "Remodelación / ampliación", "Local comercial", "Escuela", "Centro de datos / industrial", "Otro"])
pages["es.html"] = page(
    "es.html",
    "Liquid Build | Constructor con IA en el sur de la Florida",
    "Contratista general con IA en Miami, Fort Lauderdale y Palm Beach: comunidades, casas, locales, escuelas y centros de datos. Desde 1950.",
    hero("dev-aerial.jpg", "Vista aérea de una comunidad de casas en construcción", "Del terreno<br><em>a las llaves.</em>",
         "El contratista general impulsado por IA del sur de la Florida. Desarrollamos y construimos comunidades, casas, locales comerciales, escuelas y centros de datos.", cta="Empiece su proyecto")
    + stats([("1950", "fundación de Shores Development"), ("10,000+", "casas y condominios desarrollados"), ("140", "lotes en Redland Ranches"), ("IA", "estimados y seguimiento")])
    + """
<section class="wrap section">
  <h2 class="display">Lo que <em>construimos</em></h2>
  <div class="cards">
    <div class="card"><b>Comunidades</b><p class="muted">Del terreno a las llaves: estudios, permisos, calles, drenaje y casas modelo.</p></div>
    <div class="card"><b>Casas nuevas y ampliaciones</b><p class="muted">Casas a la medida, segundos pisos, piscinas y ventanas de impacto.</p></div>
    <div class="card"><b>Locales comerciales</b><p class="muted">Restaurantes y tiendas listos para el día de apertura.</p></div>
    <div class="card"><b>Escuelas y centros de datos</b><p class="muted">Obras planificadas según el calendario escolar o según la energía disponible.</p></div>
  </div>
  <p class="lead" style="margin-top:28px">¿Quiere un precio aproximado ahora? Use el <a href="/#estimate">estimador en nuestra página principal</a>. Es gratis y no pide registro.</p>
</section>"""
    + faq_section(ES_FAQS, "Preguntas <em>frecuentes</em>")
    + f"""
<section id="quote" class="quote wrap grid">
  <div class="quote-copy">
    <h2 class="display">Construyamos <em>juntos.</em></h2>
    <p class="muted lead">Cuéntenos qué tiene: un terreno, un lote o un local. Respondemos en un día hábil.</p>
    <p class="contact-lines"><a href="tel:{PHONE_TEL}">{PHONE}</a><br><a href="mailto:{EMAIL}">{EMAIL}</a><br><span class="muted">{AREA}</span></p>
  </div>
  <form class="quote-form" action="/api/quote" method="post" data-quote>
    <div class="row2">
      <label>Nombre<input name="name" type="text" autocomplete="name" required></label>
      <label>Teléfono<input name="phone" type="tel" autocomplete="tel" required></label>
    </div>
    <label>Correo electrónico<input name="email" type="email" autocomplete="email" required></label>
    <div class="row2">
      <label>Proyecto<select name="project">{es_opts}</select></label>
      <label>Ubicación<input name="location" type="text" placeholder="Ciudad o dirección"></label>
    </div>
    <label>Detalles<textarea name="details" rows="3" placeholder="Tamaño, presupuesto, fecha. Lo que sepa."></textarea></label>
    <label class="consent"><input type="checkbox" name="sms_consent" value="yes" checked> Envíenme mensajes de texto sobre esta solicitud. Pueden aplicar cargos; responda STOP para cancelar.</label>
    <label class="hp" aria-hidden="true">Company website<input name="company_website" type="text" tabindex="-1" autocomplete="off"></label>
    <input type="hidden" name="page" value="">
    <button type="submit" class="btn dark">Pedir un estimado</button>
    <p class="form-status" role="status" aria-live="polite"></p>
  </form>
</section>""",
    "", lang="es", alternates=[("en", "/"), ("es", "/es"), ("x-default", "/")], preload="dev-aerial.jpg",
)


MCP_URL = SITE + "/api/mcp"
AGENT_TOOLS = [
    ("get_company_info", "Who we are, services, service area, contact details and track record."),
    ("list_projects", "Past projects with type, location and scope."),
    ("get_ballpark_estimate", "Rough cost range for a project type, size, finish level and location. Not a bid."),
    ("ground_project_idea", "Turn an idea into a grounded plan: permits, South Florida code issues (HVHZ, flood zones), phases, timeline, risks and questions to answer."),
    ("get_quote_options", "The same choices as our quote form: project types, starting points (price, plans or design), budget bands and timelines."),
    ("request_quote", "Send your project to our team. We reply within one business day by phone, text or email. Links to plans and photos can be attached."),
]
tools_html = "".join(f'<div class="line"><b><code>{n}</code></b><span class="muted">{d}</span></div>' for n, d in AGENT_TOOLS)
pages["agents.html"] = page(
    "agents.html",
    "AI Agents: Connect to Liquid Build via MCP | Liquid Build",
    "Let Claude, ChatGPT and other AI assistants get ballpark construction estimates, South Florida permit and code help, and quotes from Liquid Build.",
    dark_hero("FOR AI AGENTS · MCP", "Your agent can<br><em>talk to us.</em>",
              "Connect any MCP-capable assistant to get ballpark estimates, ground a project idea, or send us a quote request in seconds.")
    + f"""
<section class="wrap section">
  <h2 class="display">Connect</h2>
  <p class="lead">MCP server (Streamable HTTP, no auth): <code class="big-code">{MCP_URL}</code></p>
  <p class="muted">Add it as a custom connector or remote MCP server in your assistant (Claude, ChatGPT, Cursor and others). Human? Just use the form below or call {PHONE}.</p>
  <pre class="code">{{
  "mcpServers": {{
    "liquid-build": {{ "type": "http", "url": "{MCP_URL}" }}
  }}
}}</pre>
</section>
<section class="wrap section">
  <h2 class="display">Tools</h2>
  <div class="tool-list">{tools_html}</div>
  <p class="muted small note">Estimates from these tools are ballpark ranges for planning, not bids. A real price needs a site visit and plans.</p>
</section>"""
    + quote_form("Other", "Rather talk<br><em>to a person?</em>"),
    "", over_photo=False,
)

import re
for name, content in pages.items():
    # clean URLs: /schools.html -> /schools, /index -> /
    content = re.sub(r'href="/([a-z0-9-]+)\.html"', lambda m: 'href="/' + ('' if m.group(1) == 'index' else m.group(1)) + '"', content)
    with open(os.path.join(OUT, name), "w") as f:
        f.write(content)
# ---- machine-readable files for search engines and AI crawlers ----
urls = [("privacy", "0.3"), ("track-record", "0.8"), ("general-contractor-miami", "0.8"), ("general-contractor-fort-lauderdale", "0.8"), ("general-contractor-palm-beach", "0.8"), ("es", "0.8"), ("", "1.0"), ("home-development", "0.9"), ("design-build", "0.9"), ("commercial", "0.9"), ("schools", "0.9"), ("data-centers", "0.9"), ("agents", "0.6")]
def _imgs(u):
    f = os.path.join(OUT, (u or "index") + ".html")
    try:
        found = re.findall(r'src="/images/([^"]+)" alt="([^"]*)"', open(f).read())
    except OSError:
        return ""
    seen, out = set(), ""
    for src, alt in found:
        if src in seen: continue
        seen.add(src)
        out += f"<image:image><image:loc>{SITE}/images/{src}</image:loc><image:title>{html.escape(alt)}</image:title></image:image>"
    return out
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + "".join(
    f"  <url><loc>{SITE}/{u}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority>{_imgs(u)}</url>\n" for u, pr in urls) + "</urlset>\n"
open(os.path.join(OUT, "sitemap.xml"), "w").write(sitemap)

bots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai", "PerplexityBot", "Perplexity-User",
        "Google-Extended", "Applebot", "Applebot-Extended", "Bingbot", "DuckAssistBot", "Meta-ExternalAgent", "CCBot", "cohere-ai", "MistralAI-User"]
robots = "# Search engines and AI assistants are welcome.\n" + "".join(f"User-agent: {b}\nAllow: /\nDisallow: /crm\nDisallow: /api/crm\n\n" for b in bots)
robots += "User-agent: *\nAllow: /\nDisallow: /crm\nDisallow: /api/crm\n\n" + f"Sitemap: {SITE}/sitemap.xml\n# LLM summary: {SITE}/llms.txt\n# MCP server for agents: {MCP_URL}\n"
open(os.path.join(OUT, "robots.txt"), "w").write(robots)

svc_lines = "\n".join(f"- [{sv['name']}]({SITE}/{sv['slug']}): {sv['summary']}" for sv in CO["services"])
llms = f"""# {CO['name']}

> {CO['description']}

Contact: {PHONE} (call or text) · {EMAIL} · Service area: {', '.join(CO['areaServed'][:3])}.
Replies to quote requests within one business day.

## Services
{svc_lines}

## Track record
""" + "\n".join("- " + t for t in CO["track"]) + f"""

## Track record and local pages
- [Track record: 10,000+ homes since 1950]({SITE}/track-record)
- [General contractor in Miami]({SITE}/general-contractor-miami)
- [General contractor in Fort Lauderdale]({SITE}/general-contractor-fort-lauderdale)
- [General contractor in Palm Beach]({SITE}/general-contractor-palm-beach)
- [En español]({SITE}/es)

## For AI agents
- MCP server (Streamable HTTP, no auth): {MCP_URL}
- Tools: {', '.join(n for n, _ in AGENT_TOOLS)}
- Human-readable guide: {SITE}/agents
- Estimates from the MCP tools are ballpark planning ranges, not bids.

## Optional
- [Full details for LLMs]({SITE}/llms-full.txt)
- [Liquid Permit: permits and approvals]({CO['sameAs'][1]})
- [Liquid Labor: robotics, automation and data center research]({CO['sameAs'][0]})
"""
open(os.path.join(OUT, "llms.txt"), "w").write(llms)

full = [llms, "\n# Service details and FAQs\n"]
for sv in CO["services"]:
    full.append(f"\n## {sv['name']} ({SITE}/{sv['slug']})\n{sv['summary']}\n")
    for q, a in sv["faqs"]:
        full.append(f"\n**{q}**\n{a}\n")
full.append("\n# Projects\n")
for pr in CO["projects"]:
    full.append(f"- {pr['name']}: {pr['type']}, {pr['detail']}, {pr['location']}\n")
full.append("\n# General FAQ\n")
for q, a in GENERAL_FAQS:
    full.append(f"\n**{q}**\n{a}\n")
open(os.path.join(OUT, "llms-full.txt"), "w").write("".join(full))

# MCP discovery document
os.makedirs(os.path.join(OUT, ".well-known"), exist_ok=True)
open(os.path.join(OUT, ".well-known", "mcp.json"), "w").write(json.dumps({
    "name": "liquid-build", "title": "Liquid Build: construction estimates and help", "description": CO["description"],
    "url": MCP_URL, "transport": "streamable-http", "authentication": "none", "privacy_policy": SITE + "/privacy", "documentation": SITE + "/agents",
    "tools": [{"name": n, "description": d} for n, d in AGENT_TOOLS], "contact": {"phone": PHONE, "email": EMAIL}, "website": SITE}, indent=2))

print("built", len(pages), "pages + sitemap, robots, llms.txt, llms-full.txt")
