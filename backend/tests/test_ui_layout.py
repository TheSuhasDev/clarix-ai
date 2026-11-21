"""Layout, route mapping, and CSS token validation tests for Clarix navigation."""
from __future__ import annotations

import os
import re
import unittest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")


class TestNavigationLayoutTokens(unittest.TestCase):
    """Validate CSS rules, dimensions, tokens, and responsive constraints."""

    def test_sidebar_tokens_expanded_and_collapsed(self):
        """Sidebar expanded width must be ~176px and collapsed must be ~60px."""
        tokens_path = os.path.join(FRONTEND_DIR, "src", "styles", "tokens.css")
        with open(tokens_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn("--sidebar-w-expanded: 176px;", content)
        self.assertIn("--sidebar-w-collapsed: 60px;", content)

    def test_layout_offset_gap(self):
        """Layout main content must start right after the sidebar with a 16px gap."""
        layout_path = os.path.join(FRONTEND_DIR, "src", "components", "layout", "Layout.module.css")
        with open(layout_path, "r", encoding="utf-8") as f:
            content = f.read()

        # padding-left: calc(var(--w) + 32px) ensures 16px left offset + 16px right gap
        self.assertIn("padding-left: calc(var(--w) + 32px);", content)
        self.assertIn("--sidebar-w-expanded, 176px", content)
        self.assertIn("--sidebar-w-collapsed, 60px", content)

    def test_topbar_has_no_nav_links(self):
        """TopBar must not contain hardcoded header navigation links (OVERVIEW, POLICIES, THREATS, SYSTEM)."""
        topbar_path = os.path.join(FRONTEND_DIR, "src", "components", "layout", "TopBar.tsx")
        with open(topbar_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertNotIn("Overview ↗", content)
        self.assertNotIn("Policies ↗", content)
        self.assertNotIn("Threats ↗", content)
        self.assertNotIn("System ↗", content)
        self.assertNotIn("className={styles.links}", content)

    def test_sidebar_collapsed_hit_targets(self):
        """Collapsed sidebar must center icons with 38px/40px hit targets."""
        sidebar_css_path = os.path.join(FRONTEND_DIR, "src", "components", "navigation", "Sidebar.module.css")
        with open(sidebar_css_path, "r", encoding="utf-8") as f:
            content = f.read()

        self.assertIn(".sidebar.collapsed .row", content)
        self.assertIn("width: 38px;", content)
        self.assertIn("height: 38px;", content)
        self.assertIn("margin: 0 auto;", content)

    def test_landing_page_offset_and_sidebar(self):
        """Landing page must render Sidebar and offset hero content by the sidebar width."""
        landing_tsx_path = os.path.join(FRONTEND_DIR, "src", "landing", "Landing.tsx")
        landing_css_path = os.path.join(FRONTEND_DIR, "src", "styles", "landing.css")
        with open(landing_tsx_path, "r", encoding="utf-8") as f1, open(landing_css_path, "r", encoding="utf-8") as f2:
            tsx = f1.read()
            css = f2.read()

        # Sidebar must be rendered, PillNav removed
        self.assertIn("<Sidebar", tsx)
        self.assertNotIn("<PillNav", tsx)

        # Hero copy must be present
        self.assertIn("AI you can trust <b>with classified documents</b>", tsx)
        self.assertIn("Runs fully offline. Every answer is verified. Every action is provable.", tsx)
        self.assertIn('to="/overview">Open console</Link>', tsx)

        # Landing CSS must offset content by sidebar width
        self.assertIn("--sidebar-offset: calc(var(--sidebar-w) + 32px)", css)
        self.assertIn("left:calc(var(--sidebar-offset", css)

    def test_every_nav_item_resolves_to_real_route_and_every_route_has_nav_item(self):
        """Every nav item in navItems.ts must resolve to a route in App.tsx, and every route must have a nav item."""
        app_path = os.path.join(FRONTEND_DIR, "src", "App.tsx")
        nav_path = os.path.join(FRONTEND_DIR, "src", "components", "navigation", "navItems.ts")

        with open(app_path, "r", encoding="utf-8") as f1, open(nav_path, "r", encoding="utf-8") as f2:
            app_content = f1.read()
            nav_content = f2.read()

        # Extract routes from App.tsx (e.g. <Route path="/overview" ...)
        route_matches = re.findall(r'<Route\s+path="([^"]+)"', app_content)
        app_routes = set(route_matches)
        # Exclude wildcard '*' and redirect alias '/home'
        app_routes.discard("*")
        app_routes.discard("/home")

        # Extract hrefs/paths from navItems.ts
        href_matches = set(re.findall(r'(?:path|href):\s*[\'"]([^\'"]+)[\'"]', nav_content))

        # Check every route has a nav item
        missing_in_nav = app_routes - href_matches
        self.assertEqual(
            missing_in_nav,
            set(),
            f"Routes in App.tsx missing from sidebar navItems: {missing_in_nav}"
        )

        # Check every nav item resolves to a valid route in App.tsx
        orphaned_nav = href_matches - app_routes
        self.assertEqual(
            orphaned_nav,
            set(),
            f"Nav items in navItems.ts that do not exist in App.tsx routes: {orphaned_nav}"
        )

    def test_card_contrast_and_robot_opacity(self):
        """Ensure card backgrounds are sufficiently opaque and robot opacity is reduced for WCAG AA contrast."""
        layout_css_path = os.path.join(FRONTEND_DIR, "src", "components", "layout", "Layout.module.css")
        ds_css_path = os.path.join(FRONTEND_DIR, "src", "styles", "ds.css")

        with open(layout_css_path, "r", encoding="utf-8") as f1, open(ds_css_path, "r", encoding="utf-8") as f2:
            layout_css = f1.read()
            ds_css = f2.read()

        self.assertIn("opacity: 0.32;", layout_css)
        self.assertIn(".cx-card", ds_css)
        self.assertIn("rgba(255,255,255,.94)", ds_css)

    def test_performance_mode_supported(self):
        """Reduced-effects / Performance mode must disable backdrop filters and heavy animations."""
        sidebar_css_path = os.path.join(FRONTEND_DIR, "src", "components", "navigation", "Sidebar.module.css")
        with open(sidebar_css_path, "r", encoding="utf-8") as f:
            s_content = f.read()

        self.assertIn("performance-mode", s_content)
        self.assertIn("backdrop-filter: none !important;", s_content)


if __name__ == "__main__":
    unittest.main()
