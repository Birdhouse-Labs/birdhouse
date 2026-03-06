# Birdhouse Labs Marketing Site

High-energy marketing landing page for Birdhouse Labs - AI agent orchestration
platform.

## 🚀 What's Inside

A complete, responsive landing page built with:

- **Lume** - Static site generator
- **DaisyUI** - Tailwind CSS component library
- **Tailwind CSS** - Utility-first styling
- **Deno** - Modern JavaScript runtime

## 🛠️ Prerequisites & Setup

### Required Tools

1. **Deno** (see .tool-versions) - TypeScript/JavaScript runtime
2. **direnv** - Environment variable management

### Installation

#### 1. Install direnv

Follow the
[direnv installation guide](https://direnv.net/docs/installation.html) for your
OS:

#### 2. Install Deno using asdf

Install [asdf](https://asdf-vm.com/guide/getting-started.html) following their
guide, then:

```bash
# Add Deno plugin
asdf plugin add deno https://github.com/asdf-community/asdf-deno.git

# Install Deno (latest stable)
asdf install deno latest

# Set as global version
asdf global deno latest

# Verify installation
deno --version
```

#### 3. Enable direnv in this project

```bash
# Navigate to this directory
cd projects/marketing

# Allow direnv to load the .envrc file
direnv allow
```

This will automatically load your environment variables from the `.env` file.

### Setup Supabase Integration

#### 1. Create `.env` file

```bash
# Copy the example configuration
cp .env.example .env
```

**Get your credentials:**

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Settings > API**
4. Copy the Project URL and anon key (public key)

Example `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

#### 2. Create Supabase Table

In your Supabase project, run this SQL in the SQL editor:

```sql
CREATE TABLE waitlist (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable public insert (RLS policy)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public inserts" ON waitlist
  FOR INSERT WITH CHECK (true);
```

## 🚀 Development

```bash
# Development server with hot reload
deno task serve
# Opens at http://localhost:3000

# Build for production
deno task build
# Output: ./_site/index.html + assets

# File changes to watch:
# - index.vto (main page)
# - _includes/layout.vto (HTML template)
# - assets/script.js (client-side form handling)
# - assets/styles.css (Tailwind + DaisyUI)
```

## 📝 Key Copy Points

**Hype messaging for developers:**

- ✅ "Collaborate. Delegate. Multiply."
- ✅ "Agents Create Agents"
- ✅ "Any Model. Any Provider."
- ✅ "Built in 3 months. We use it daily. We can't go back."

**Credibility signals:**

- Shipped 3 prior AI products (Deal Spaces, Document Ingestion, Locomotive)
- 1.5 years founder collaboration
- Both write code
- 3 months full-time equivalent

**Urgency drivers:**

- "Beta launches March 1st"
- "YC Batch April"
- "First 100 testers get direct access"

## 🔗 Sections with Anchors

- `#features` - Feature sections jump point
- `#founders` - Founders section jump point
- `#waitlist` - Waitlist form section

## 📋 Features

### ✅ Completed

- **Waitlist Form** - Supabase integration with client-side form submission
- **Environment Management** - direnv + .env configuration
- **Dark Mode** - DaisyUI theme system ready
- **Smooth Scrolling** - Native browser scroll
- **Animations** - GSAP ticker animations

### 📋 Future Enhancements

- [ ] **Analytics** - Add GA4 or PostHog tracking
- [ ] **Images** - Replace gradient placeholders with actual product screenshots
- [ ] **Video** - Embed demo video in hero or Feature 1
- [ ] **Email Notifications** - Trigger welcome email on form submission
- [ ] **Advanced Scroll Animations** - Fade-in, parallax effects

## 📦 Build Output

```
_site/
├── index.html (331 lines, production-ready)
└── assets/
    └── styles.css (Tailwind + DaisyUI bundle)
```

Ready to deploy to:

- Vercel
- Netlify
- GitHub Pages
- Any static host

## 🎯 Performance

- **Size**: 331 lines HTML + ~30KB CSS (DaisyUI bundle)
- **Score**: Optimized for Core Web Vitals
- **Theme**: Dark mode (no flashing on load)
- **Responsive**: Mobile-first, 0 JS required

## 🐛 Troubleshooting

### "Supabase client not initialized" error

**Cause:** `.env` file not configured or direnv not active

**Solution:**

```bash
# Create .env file
cp .env.example .env

# Edit with your Supabase credentials
nano .env

# Reload direnv
direnv reload

# Verify environment variables are loaded
env | grep SUPABASE
```

### direnv not loading variables

**Cause:** direnv hook not installed or project not allowed

**Solution:**

```bash
# Ensure direnv is hooked in your shell (see Installation section)
# Then allow the project:
direnv allow

# Verify it's working:
direnv status
```

### Deno version mismatch

**Cause:** asdf not using correct Deno version

**Solution:**

```bash
# Check current version
deno --version

# View available versions
asdf list deno

# Reinstall if needed
asdf uninstall deno <version>
asdf install deno latest
```

### Form submission fails silently

**Cause:** Supabase credentials incorrect or table not accessible

**Solution:**

1. Check browser console for errors: `F12` → Console tab
2. Verify `.env` has correct credentials
3. Check Supabase table exists with correct columns
4. Ensure RLS policy allows public inserts

## 📚 References

- [Deno Documentation](https://deno.land)
- [direnv Documentation](https://direnv.net)
- [asdf Documentation](https://asdf-vm.com)
- [Supabase Client Docs](https://supabase.com/docs/reference/javascript)
- [DaisyUI Docs](https://daisyui.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Lume SSG](https://lume.land)
