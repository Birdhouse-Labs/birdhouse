import Lenis from "lenis";
import lucide from "lucide";
import { themeChange } from "theme-change";
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

// Initialize Lenis for smooth scrolling
const lenis = new Lenis({
  autoRaf: true,
  anchors: true,
});

if (lenis && lenis.targetScroll > 1) {
  const header = document.querySelector("#nav");
  header.setAttribute("data-scrolling", "true");
}

// Handle scroll events (optional - for logging or analytics)
lenis.on("scroll", (e) => {
  const header = document.querySelector("#nav");
  if (e.progress > 0.01) {
    header.setAttribute("data-scrolling", "true");
  } else {
    header.setAttribute("data-scrolling", "false");
  }
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  lenis.destroy();
});

const speed = 50; // Pixels per second

// 1. Select the target and store original HTML
let target = document.querySelector(".news_gsap");
let original_html = target.innerHTML;

// 2. Wrap the original content and duplicate it
// We add 'flex-none' to ensure the blocks don't shrink
let new_html =
  `<div class='ticker-items flex flex-none'>${original_html}</div>`;
target.innerHTML = new_html + new_html;

// 3. Calculate dimensions based on one of the blocks
let tickerItems = document.querySelectorAll(".ticker-items");
let tickerWidth = tickerItems[0].offsetWidth;
let initDuration = tickerWidth / speed;

// 4. The Animation
// Animating xPercent: -100 moves each block exactly its own width to the left
gsap.to(".ticker-items", {
  xPercent: -100,
  duration: initDuration,
  ease: "none",
  repeat: -1,
});

document.getElementById("ticker-container").style.opacity = "1";

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
      submitButton.innerHTML =
        '<span class="loading loading-spinner loading-md"></span>';

      const formData = new FormData(form);
      const data = {
        email: formData.get("email"),
      };

      const { error } = await supabaseClient
        .from("waitlist")
        .insert(data);

      if (error) {
        throw error;
      }

      // Success: Replace form fields and button with success message
      const cardBody = form.closest(".card-body");
      cardBody.innerHTML = `
        <div class="text-center space-y-4">
          <h3 class="text-2xl font-bold text-base-content">🎉 You're on the waitlist!</h3>
          <p class="text-base-content/80">
            We've received your signup for the limited beta starting in March 2026.
          </p>
          <p class="text-base-content/60 text-sm">
            Check your email for updates and exclusive beta access information.
          </p>

          <div class="divider"></div>

          <div class="space-y-3">
            <p class="text-sm text-base-content/70 font-medium">Help spread the word!</p>
            <a
              href="https://twitter.com/intent/tweet?text=${
        encodeURIComponent(
          "Just signed up to join the limited beta of @BirdhouseLabsAI, the multi-agent software development tool.\n\nCheck it out:",
        )
      }&url=${encodeURIComponent("https://birdhouselabs.ai")}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn-outline btn-sm gap-2"
            >
              <img src="/assets/x-logo.svg" alt="X logo" class="w-4 h-4 invert" />
              Share
            </a>
          </div>
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
      errorMessage.className = "alert alert-error";
      errorMessage.innerHTML = `
        <div>
          <span>${
        error.message || "Failed to submit form. Please try again."
      }</span>
        </div>
      `;
      form.insertBefore(errorMessage, form.firstChild);

      // Remove error message after 5 seconds
      setTimeout(() => {
        errorMessage.remove();
      }, 5000);
    }
  });
});
