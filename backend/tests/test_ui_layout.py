"""Layout and CSS token validation tests for Clarix glass navigation."""
from __future__ import annotations

import os
import re
import unittest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")


class TestNavigationLayoutTokens(unittest.TestCase):
    """Validate CSS rules, dimensions, tokens, and responsive constraints."""

    def test_sidebar_tokens_expanded_and_collapsed(self):
        """Sidebar expanded width must be 200px and collapsed must be 64px."""
        tokens_path = os.path.join(FRONTEND_DIR, "src", "styles", "tokens.css")
        with open(tokens_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("--sidebar-w-expanded: 200px;", content)
        self.assertIn("--sidebar-w-collapsed: 64px;", content)

    def test_layout_offset_gap(self):
        """Layout main content must start right after the sidebar with a 16px gap."""
        layout_path = os.path.join(FRONTEND_DIR, "src", "components", "layout", "Layout.module.css")
        with open(layout_path, "r", encoding="utf-8") as f:
            content = f.read()

        # padding-left: calc(var(--w) + 32px) ensures 16px left offset + 16px right gap
        self.assertIn("padding-left: calc(var(--w) + 32px);", content)
        self.assertIn("--sidebar-w-expanded, 200px", content)
        self.assertIn("--sidebar-w-collapsed, 64px", content)

    def test_pill_nav_layout_constraints(self):
        """PillNav must be a single flex row with 52px height, 26px radius, and overflow hidden."""
        pill_css_path = os.path.join(FRONTEND_DIR, "src", "components", "navigation", "PillNav.module.css")
        with open(pill_css_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("height: 52px;", content)
        self.assertIn("border-radius: 26px;", content)
        self.assertIn("overflow: hidden;", content)
        self.assertIn("flex-direction: row", content)
        self.assertIn("width: fit-content;", content)
        self.assertIn("width: 36px;", content)  # logo size inside pill

    def test_sidebar_collapsed_hit_targets(self):
        """Collapsed sidebar must center icons with 40px hit targets."""
        sidebar_css_path = os.path.join(FRONTEND_DIR, "src", "components", "navigation", "Sidebar.module.css")
        with open(sidebar_css_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn(".sidebar.collapsed .row", content)
        self.assertIn("width: 40px;", content)
        self.assertIn("height: 40px;", content)
        self.assertIn("margin: 0 auto;", content)

    def test_landing_page_has_no_sidebar_and_correct_copy(self):
        """Landing page must use only PillNav (no Sidebar) and have Clarix hero copy."""
        landing_tsx_path = os.path.join(FRONTEND_DIR, "src", "landing", "Landing.tsx")
        with open(landing_tsx_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Sidebar must not be imported or rendered
        self.assertNotIn("<Sidebar", content)
        self.assertNotIn("import { Sidebar }", content)

        # Hero copy must be updated
        self.assertIn("AI you can trust <b>with classified documents</b>", content)
        self.assertIn("Runs fully offline. Every answer is verified. Every action is provable.", content)
        self.assertIn('to="/overview">Open console</Link>', content)

        # Old placeholder copy and counter must be removed
        self.assertNotIn("The clarity your business", content)
        self.assertNotIn("[001 /004]", content)

    def test_performance_mode_supported(self):
        """Reduced-effects / Performance mode must disable backdrop filters and heavy animations."""
        pill_css_path = os.path.join(FRONTEND_DIR, "src", "components", "navigation", "PillNav.module.css")
        sidebar_css_path = os.path.join(FRONTEND_DIR, "src", "components", "navigation", "Sidebar.module.css")
        with open(pill_css_path, "r", encoding="utf-8") as f1, open(sidebar_css_path, "r", encoding="utf-8") as f2:
            p_content = f1.read()
            s_content = f2.read()

        self.assertIn("performance-mode", p_content)
        self.assertIn("backdrop-filter: none !important;", p_content)
        self.assertIn("performance-mode", s_content)
        self.assertIn("backdrop-filter: none !important;", s_content)


if __name__ == "__main__":
    unittest.main()
