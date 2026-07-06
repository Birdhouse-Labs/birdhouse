import lucide from "lucide";
import { gsap } from "gsap";
import posthog from "posthog-js";

posthog.init(window.POSTHOG_PUBLIC_KEY, {
  api_host: "https://us.i.posthog.com",
  defaults: "2026-01-30",
});

posthog.capture("page_view", { property: "value" });

// Initialize theme from checkbox state
function initializeTheme() {
  const themeCheckbox = document.querySelector(".theme-controller");
  if (themeCheckbox && themeCheckbox.checked) {
    document.body.setAttribute("data-theme", "ember-forge-dark");
  } else {
    document.body.removeAttribute("data-theme");
  }
}

// Run on page load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeTheme();
  });
} else {
  initializeTheme();
}

const supabaseClient = supabase.createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY,
);

lucide.createIcons();

// Handle scroll events for navbar background
window.addEventListener("scroll", () => {
  const header = document.querySelector("#nav");
  if (window.scrollY > 10) {
    header.setAttribute("data-scrolling", "true");
  } else {
    header.setAttribute("data-scrolling", "false");
  }
});

function formatMetricNumber(value) {
  const isTokens = value >= 10000;
  const options = {
    notation: isTokens ? "compact" : "standard",
    maximumFractionDigits: 1,
  };
  return new Intl.NumberFormat("en-US", options).format(value);
}

function initTelemetryMetrics() {
  const agentsEl = document.getElementById("metric-agents");
  const tokensEl = document.getElementById("metric-tokens");
  if (!agentsEl || !tokensEl) return;

  const agentsObj = { value: 0 };
  const tokensObj = { value: 0 };
  let activeAgentsTween = null;
  let activeTokensTween = null;

  // Phase 1: start counting toward conservative placeholders immediately
  activeAgentsTween = gsap.to(agentsObj, {
    value: 500,
    duration: 8,
    ease: "power1.out",
    onUpdate: () => {
      agentsEl.textContent = formatMetricNumber(Math.round(agentsObj.value));
    },
  });

  activeTokensTween = gsap.to(tokensObj, {
    value: 5_000_000,
    duration: 8,
    ease: "power1.out",
    onUpdate: () => {
      tokensEl.textContent = formatMetricNumber(Math.round(tokensObj.value));
    },
  });

  // Phase 2: fetch real data, then tween from current value to actual targets
  function fetchAndTween() {
    supabaseClient
      .rpc("get_telemetry_totals")
      .then(({ data, error }) => {
        if (error || !data) throw error || new Error("No data");

        const agents = data.agents_created || 0;
        const tokens = data.total_tokens || 0;

        activeAgentsTween?.kill();
        activeTokensTween?.kill();

        activeAgentsTween = gsap.to(agentsObj, {
          value: agents,
          duration: 2,
          ease: "power2.out",
          onUpdate: () => {
            agentsEl.textContent = formatMetricNumber(Math.round(agentsObj.value));
          },
        });

        activeTokensTween = gsap.to(tokensObj, {
          value: tokens,
          duration: 2,
          ease: "power2.out",
          onUpdate: () => {
            tokensEl.textContent = formatMetricNumber(Math.round(tokensObj.value));
          },
        });
      })
      .catch((err) => {
        console.warn("Failed to load telemetry metrics:", err.message);
      });
  }

  fetchAndTween();
  setInterval(fetchAndTween, 30000);
}

initTelemetryMetrics();

// Waitlist Form Handler with Supabase
window.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#waitlist form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get the submit button
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonContent = submitButton.innerHTML;

    try {
      // Transform button to loader
      submitButton.disabled = true;
      submitButton.innerHTML = 'Signing up…';

      const formData = new FormData(form);
      const data = {
        email: formData.get("email"),
      };

      const { error } = await supabaseClient
        .from("mailing_list")
        .insert(data);

      if (error) {
        throw error;
      }

      // Success: Replace form with success message
      const formContainer = form.closest("div");
      formContainer.innerHTML = `
        <div class="text-center py-4 flex flex-col gap-2">
          <p class="text-2xl">🎉</p>
          <p class="font-semibold text-[#1A1917]">You're signed up!</p>
          <p class="text-sm text-[#6B7280]">We'll keep you posted on Birdhouse news and updates.</p>
        </div>
      `;

      // Re-initialize lucide icons for the newly added icon
      lucide.createIcons();
    } catch (error) {
      // Error: Reset button and show error message
      console.error("Form submission error:", error);
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonContent;

      // Show error message
      const errorMessage = document.createElement("div");
      errorMessage.className = "text-sm text-red-600 text-center";
      errorMessage.textContent = error.message || "Failed to submit. Please try again.";
      form.insertBefore(errorMessage, form.firstChild);

      // Remove error message after 5 seconds
      setTimeout(() => {
        errorMessage.remove();
      }, 5000);
    }
  });
});
