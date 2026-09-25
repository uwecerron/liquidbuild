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
    "Land / home development",
    "Design-build",
    "New custom home",
    "Renovation / addition",
    "Commercial build-out",
    "School / education",
    "Data center / industrial",
    "Other",
]


def logo(cls=""):
    return f'<span class="logo {cls}"><b>liquid</b><i>build</i></span>'


def header(active, over_photo):
    links = "".join(
        '<a href="/' + href + '"' + (' aria-current="page"' if href == active else '') + '>' + label + '</a>'
        for href, label in NAV
    )
    return f"""
<header class="site-header{' on-photo' if over_photo else ''}">
  <div class="wrap bar">
    <a href="/" class="brand" aria-label="liquid build home">{logo()}</a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Open menu">
    <label for="nav-toggle" class="burger" aria-hidden="true"><span></span><span></span></label>
    <nav aria-label="Main">{links}<a href="#quote" class="pill">Get a quote</a></nav>
  </div>
</header>"""


def quote_form(preset, headline="Let's <em>build.</em>", sub="Land, a lot or a lease: tell us what you have. We reply within one business day."):
    opts = "".join(
        f'<option{" selected" if t == preset else ""}>{html.escape(t)}</option>' for t in PROJECT_TYPES
    )
    return f"""
<section id="quote" class="quote wrap grid">
  <div class="quote-copy">
    <h2 class="display">{headline}</h2>
    <p class="muted lead">{sub}</p>
    <p class="contact-lines"><a href="tel:{PHONE_TEL}">{PHONE}</a><br><a href="mailto:{EMAIL}">{EMAIL}</a><br><span class="muted">{AREA}</span></p>
  </div>
  <form class="quote-form" action="/api/quote" method="post" data-quote>
    <div class="row2">
      <label>Name<input name="name" type="text" autocomplete="name" required></label>
      <label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>
    </div>
    <label>Email<input name="email" type="email" autocomplete="email" required></label>
    <div class="row2">
      <label>Project<select name="project">{opts}</select></label>
      <label>Location<input name="location" type="text" placeholder="City or address"></label>
    </div>
    <label>Details<textarea name="details" rows="3" placeholder="Size, budget, timeline. Whatever you know."></textarea></label>
    <label class="consent"><input type="checkbox" name="sms_consent" value="yes" checked> Text me about this request. Msg &amp; data rates may apply; reply STOP to opt out.</label>
    <label class="hp" aria-hidden="true">Company website<input name="company_website" type="text" tabindex="-1" autocomplete="off"></label>
    <input type="hidden" name="page" value="">
    <button type="submit" class="btn dark">Request a quote</button>
    <p class="form-status" role="status" aria-live="polite"></p>
  </form>
</section>"""


def footer():
    links = "".join(f'<a href="/{h}">{l}</a>' for h, l in NAV)
    return f"""
<footer class="site-footer">
  <div class="wrap foot">
    <div>{logo('dark')}<p class="muted">Liquid Build LLC · {AREA}</p><p class="muted license" data-license></p></div>
    <div class="foot-links">{links}</div>
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
    faqs = SERVICES[slug]["faqs"] if slug in SERVICES else (GENERAL_FAQS if slug == "index" else [])
    if faqs:
        graph.append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]})
    return url, json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace("</", "<\\/")


def faq_section(faqs, title="Questions, <em>answered</em>"):
    items = "".join(f'<details><summary>{html.escape(q)}</summary><p>{html.escape(a)}</p></details>' for q, a in faqs)
    return f'<section class="wrap section faq"><h2 class="display">{title}</h2><div class="faq-list">{items}</div></section>'


GENERAL_FAQS = [
    ("What does Liquid Build do?", CO["description"]),
    ("Where do you work?", "Miami-Dade, Broward and Palm Beach counties. That covers Miami, Fort Lauderdale, West Palm Beach and the towns in between, including Key Biscayne, Homestead and the Redland."),
    ("How fast do you reply to a quote request?", "Within one business day. Call or text " + PHONE + " for anything urgent."),
    ("Can my AI assistant get an estimate from you?", "Yes. Agents can connect to our MCP server at " + SITE + "/api/mcp for company info, ballpark estimates, project grounding and quote requests. See " + SITE + "/agents."),
]


def page(filename, title, desc, body, active="", over_photo=True, index=True):
    url, ld = ld_for(filename, title, desc)
    robots = "index, follow, max-image-preview:large, max-snippet:-1" if index else "noindex, follow"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Liquid Build">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{SITE}/images/dev-aerial.jpg">
<meta property="og:image:alt" content="Aerial view of a Liquid Build single-family community under construction">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{SITE}/images/dev-aerial.jpg">
<meta name="geo.region" content="US-FL">
<meta name="geo.placename" content="Fort Lauderdale; Miami; West Palm Beach">
<link rel="alternate" type="text/plain" title="LLM summary" href="/llms.txt">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/logo.png">
<script type="application/ld+json">{ld}</script>
</head>
<body>
{header(active, over_photo)}
<main>
{body}
</main>
{footer()}
<script src="/site.js" defer></script>
</body>
</html>"""


def hero(img, alt, h1, sub, cta="Start your project", tall=False):
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
  <div class="section-head"><h2 class="display">Communities</h2><p class="muted">Developed by our team at Shores Development &amp; Selenis</p></div>
  <div class="mosaic">
    <div class="m-big">{fig('redland-ranches.jpg','New single-family homes rising on graded land at Redland Ranches','Redland Ranches · Redland','57 homes',520)}</div>
    <div class="m-stack">
      {fig('toscana.jpg','Rendering of a one-story Mediterranean-style Toscana home','Toscana','24 single-family homes',250)}
      {fig('casabella.jpg','Rendering of a two-story Casabella home with tile roof','Casabella','Two-story model',250)}
    </div>
  </div>
  <div class="triple">
    <div class="line"><b>Las Palmas</b><span class="muted">19 units</span></div>
    <div class="line"><b>Villa Harbour</b><span class="muted">Waterfront community renovation</span></div>
    <div class="line"><b>Mid-rise</b><span class="muted">25-unit building</span></div>
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
    "AI-powered general contractor and developer in South Florida: single-family communities, custom homes, commercial build-outs, schools and data centers. 300+ homes and units developed. Call 305-833-5025.",
    hero("dev-aerial.jpg", "Aerial view of a new single-family community under construction", "From raw land<br><em>to keys in hand.</em>",
         "The AI-powered general contractor for South Florida. We develop and build communities, custom homes, commercial space, schools and data centers.", tall=True)
    + stats([("300+", "homes &amp; condo units developed"), ("100", "homes across three communities"), ("Land → Keys", "sitework, vertical, finishes"), ("AI-powered", "estimating, follow-up and permits")])
    + AI_SECTION + ESTIMATOR + SECTORS + COMMUNITIES + CUSTOM_HOMES + COMMERCIAL_GRID
    + faq_section(GENERAL_FAQS)
    + quote_form("Land / home development"),
)

pages["home-development.html"] = page(
    "home-development.html",
    "Home Development & Single-Family Communities in South Florida | Liquid Build",
    "Single-family community development in Miami-Dade, Broward and Palm Beach: land feasibility, entitlements, sitework, model homes and production building. Redland Ranches, Toscana, Las Palmas.",
    hero("dev-aerial.jpg", "Aerial view of a new single-family community under construction", "Home<br><em>development.</em>",
         "Raw land in, finished streets out. We take single-family communities from entitlements to closings.")
    + stats([("57", "homes · Redland Ranches"), ("24", "homes · Toscana"), ("19", "units · Las Palmas"), ("300+", "units developed by our team")])
    + steps("Land to keys", [
        ("Land & feasibility", "Site due diligence, yield studies, budget and schedule before you close."),
        ("Entitlements & permits", "Plats, zoning and building permits, coordinated with Liquid Permit."),
        ("Sitework", "Clearing, fill, roads, drainage, water and sewer."),
        ("Vertical", "Model homes first, then production building lot by lot."),
    ])
    + COMMUNITIES
    + faq_section(SERVICES["home-development"]["faqs"])
    + quote_form("Land / home development", "Have land?<br><em>Let's plan it.</em>"),
    "home-development.html",
)

pages["design-build.html"] = page(
    "design-build.html",
    "Design-Build Contractor in Miami & Fort Lauderdale | Liquid Build",
    "Design-build in South Florida: one contract and one team for design, engineering, permits and construction of homes, commercial interiors, schools and industrial buildings.",
    hero("pool-aerial.jpg", "Aerial view of a new pool and spa with paver deck", "Design-<em>build.</em>",
         "One contract and one team from first sketch to final inspection. Price and schedule are set early and stay put.")
    + cards("Why <em>design-build</em>", [
        ("One point of contact", "Design, engineering, permits and construction run through one team."),
        ("Price early", "Budget is set during design, not after bids come back high."),
        ("Faster start", "Permits and early site work move while drawings are finished."),
        ("Fewer change orders", "The people drawing it are the people building it."),
    ])
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
    "Restaurant & Retail Build-Out Contractor in Miami | Liquid Build",
    "Commercial build-outs in South Florida for restaurants, retail and offices, including Chili's at FIU, Starbucks and Carlos Albizu University. Built to brand spec and opening date.",
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
    "Charter, private and higher-education construction in Miami-Dade, Broward and Palm Beach, phased around the school calendar. Recent work: Carlos Albizu University, FIU Graham Center.",
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
    "Data Center & Industrial Construction in Florida | Liquid Build",
    "Power-first data center construction in Florida: site and power diligence, sitework and pads, shell and core, and electrical and mechanical coordination for fast energization.",
    dark_hero("DATA CENTERS · INDUSTRIAL", "Power first.<br><em>Built fast.</em>",
              "The constraint is megawatts, not square feet. We plan sites around power and build the shell, pads and infrastructure to energize on schedule.")
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
    "data-centers.html",
    over_photo=False,
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
    <li><b>What you send us:</b> your name, phone, email, project type, location and project details, from our forms, by text, by email, or through an AI assistant using our <code>request_quote</code> tool.</li>
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
  <p>We use service providers to run the site and talk with you: Vercel (hosting), Neon (database), Twilio (text messages), Resend and FormSubmit (email). They process data only to provide those services.</p>
  <h2>AI assistants and our MCP server</h2>
  <p>Our MCP server at <code>{SITE}/api/mcp</code> does not require an account. Estimate and planning tools do not store personal information. When an assistant calls <code>request_quote</code>, the name, contact details and project description it sends are saved as a quote request, the same as our website form. We do not receive your conversation with the assistant beyond what the tool call contains.</p>
  <h2>How long we keep it</h2>
  <p>We keep quote requests and project records as long as needed to respond, do the work and meet legal and warranty obligations. Ask us to delete your information at any time.</p>
  <h2>Your choices</h2>
  <p>To see, correct or delete your information, or to stop texts or emails, contact us at <a href="mailto:{EMAIL}">{EMAIL}</a> or {PHONE}.</p>
  <h2>Contact</h2>
  <p>Liquid Build LLC · {AREA} · <a href="mailto:{EMAIL}">{EMAIL}</a> · {PHONE}</p>
</section>""",
    over_photo=False,
)

MCP_URL = SITE + "/api/mcp"
AGENT_TOOLS = [
    ("get_company_info", "Who we are, services, service area, contact details and track record."),
    ("list_projects", "Past projects with type, location and scope."),
    ("get_ballpark_estimate", "Rough cost range for a project type, size, finish level and location. Not a bid."),
    ("ground_project_idea", "Turn an idea into a grounded plan: permits, South Florida code issues (HVHZ, flood zones), phases, timeline, risks and questions to answer."),
    ("request_quote", "Send your project to our team. We reply within one business day by phone, text or email."),
]
tools_html = "".join(f'<div class="line"><b><code>{n}</code></b><span class="muted">{d}</span></div>' for n, d in AGENT_TOOLS)
pages["agents.html"] = page(
    "agents.html",
    "Connect Your AI Agent to Liquid Build (MCP) | Estimates & Construction Help",
    "AI assistants can connect to Liquid Build's MCP server for ballpark construction estimates, help grounding project ideas in South Florida code and permits, and quote requests.",
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
urls = [("privacy", "0.3"), ("", "1.0"), ("home-development", "0.9"), ("design-build", "0.9"), ("commercial", "0.9"), ("schools", "0.9"), ("data-centers", "0.9"), ("agents", "0.6")]
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
    f"  <url><loc>{SITE}/{u}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority></url>\n" for u, pr in urls) + "</urlset>\n"
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
