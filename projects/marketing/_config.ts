import lume from "lume/mod.ts";
import attributes from "lume/plugins/attributes.ts";
import date from "lume/plugins/date.ts";
import code_highlight from "lume/plugins/code_highlight.ts";
import esbuild from "lume/plugins/esbuild.ts";
import check_urls from "lume/plugins/check_urls.ts";
import tailwindcss from "lume/plugins/tailwindcss.ts";
import sourceMaps from "lume/plugins/source_maps.ts";
import seo from "lume/plugins/seo.ts";
import robots from "lume/plugins/robots.ts";
import sitemap from "lume/plugins/sitemap.ts";
import metas from "lume/plugins/metas.ts";
import transformImages from "lume/plugins/transform_images.ts";

const site = lume({
  location: new URL(Deno.env.get("HOST")),
});

site.data("SUPABASE_URL", Deno.env.get("SUPABASE_URL"));
site.data("SUPABASE_ANON_KEY", Deno.env.get("SUPABASE_ANON_KEY"));
site.data("POSTHOG_PUBLIC_KEY", Deno.env.get("POSTHOG_PUBLIC_KEY"));

site.use(attributes());
site.use(date());
site.use(code_highlight());
site.use(esbuild());
site.use(check_urls());
site.use(tailwindcss());
site.use(robots());
site.use(sitemap());
site.use(sourceMaps());
site.use(metas());
site.use(seo());
site.use(transformImages(/* Options */));
site.add("assets");
site.add("favicon.ico");

export default site;
