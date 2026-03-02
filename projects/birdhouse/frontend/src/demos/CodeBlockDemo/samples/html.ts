// ABOUTME: HTML/CSS code sample for syntax highlighting demo
// ABOUTME: Demonstrates semantic HTML, CSS Grid, Flexbox, and responsive design

import type { CodeSample } from "./types";

export const html: CodeSample = {
  id: "html",
  name: "HTML/CSS",
  language: "html",
  description: "A responsive developer portfolio with semantic HTML and modern CSS",
  code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jane Dev - Portfolio That Definitely Wasn't Built at 3am</title>
  <style>
    /* CSS Grid: Because tables are for data, not layout (we learned this in 2010) */
    :root {
      --primary: #6366f1;
      --bg-dark: #1e293b;
      --text-muted: #94a3b8;
      --card-bg: #334155;
      --shadow: rgba(0, 0, 0, 0.2);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box; /* The only correct box model */
    }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg-dark);
      color: #f1f5f9;
      line-height: 1.6;
    }

    /* Header with Flexbox - the technology that saved us from float: left nightmares */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2rem 5%;
      background: linear-gradient(135deg, var(--primary), #8b5cf6);
      box-shadow: 0 4px 6px var(--shadow);
    }

    .logo {
      font-size: 1.5rem;
      font-weight: bold;
    }

    nav ul {
      display: flex;
      gap: 2rem;
      list-style: none;
    }

    nav a {
      color: white;
      text-decoration: none;
      transition: opacity 0.3s ease; /* Smooth like butter */
    }

    nav a:hover {
      opacity: 0.8;
    }

    /* Main content with CSS Grid - works better than my relationships */
    main {
      max-width: 1200px;
      margin: 3rem auto;
      padding: 0 5%;
    }

    .hero {
      text-align: center;
      padding: 4rem 0;
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 3.5rem); /* Responsive without @media queries? Magic! */
      margin-bottom: 1rem;
    }

    .hero p {
      font-size: 1.2rem;
      color: var(--text-muted);
    }

    /* Project Grid - where your side projects go to feel important */
    .projects {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
      margin-top: 3rem;
    }

    .project-card {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 8px 16px var(--shadow);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    /* The hover effect that makes stakeholders think it's interactive */
    .project-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 24px var(--shadow);
    }

    .project-card h3 {
      color: var(--primary);
      margin-bottom: 1rem;
    }

    .tech-stack {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .tech-badge {
      background: var(--primary);
      padding: 0.25rem 0.75rem;
      border-radius: 999px; /* Just say "fully rounded" like a normal person */
      font-size: 0.875rem;
    }

    /* Footer with Flexbox - keeping it simple since no one reads footers anyway */
    footer {
      margin-top: 5rem;
      padding: 2rem 5%;
      text-align: center;
      border-top: 1px solid var(--card-bg);
      color: var(--text-muted);
    }

    /* Responsive breakpoint - because mobile users exist (apparently) */
    @media (max-width: 768px) {
      header {
        flex-direction: column;
        gap: 1rem;
      }

      nav ul {
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo">Jane Dev</div>
    <nav>
      <ul>
        <li><a href="#about">About</a></li>
        <li><a href="#projects">Projects</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </header>

  <main>
    <section class="hero">
      <h1>Full-Stack Developer &amp; Coffee Enthusiast</h1>
      <p>Building things that work (most of the time)</p>
    </section>

    <section class="projects" id="projects">
      <article class="project-card">
        <h3>TodoMVC Clone #47</h3>
        <p>Yet another todo app, but this one has dark mode and uses the latest framework du jour.</p>
        <div class="tech-stack">
          <span class="tech-badge">React</span>
          <span class="tech-badge">TypeScript</span>
          <span class="tech-badge">Hope</span>
        </div>
      </article>

      <article class="project-card">
        <h3>Portfolio Site</h3>
        <p>A recursive masterpiece. This very site you're looking at. Meta level: 100.</p>
        <div class="tech-stack">
          <span class="tech-badge">HTML5</span>
          <span class="tech-badge">CSS Grid</span>
          <span class="tech-badge">Flexbox</span>
        </div>
      </article>

      <article class="project-card">
        <h3>Unfinished Side Project</h3>
        <p>Started with enthusiasm at 2am. Abandoned when Stack Overflow couldn't solve my problems.</p>
        <div class="tech-stack">
          <span class="tech-badge">Node.js</span>
          <span class="tech-badge">Dreams</span>
          <span class="tech-badge">Regret</span>
        </div>
      </article>
    </section>
  </main>

  <footer>
    <p>&copy; 2024 Jane Dev. Powered by caffeine and Stack Overflow.</p>
  </footer>
</body>
</html>`,
};
