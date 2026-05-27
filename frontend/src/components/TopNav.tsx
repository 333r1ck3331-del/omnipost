import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "灵感", end: true },
  { to: "/ideas", label: "灵感库" },
  { to: "/library", label: "内容库" },
  { to: "/crawl", label: "信息流" },
  { to: "/review", label: "审核" },
  { to: "/settings", label: "设置" },
];

export default function TopNav() {
  return (
    <nav className="border-b border-paper-300 bg-paper-50/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-8 flex items-center gap-1 h-16">
        <div className="flex items-baseline gap-2 mr-8">
          <NavLink
            to="/"
            className="font-serif text-[22px] font-semibold text-ink-900 hover:text-accent-600 transition"
          >
            OmniPost
          </NavLink>
          <NavLink
            to="/changelog"
            title="版本记录"
            className={({ isActive }) =>
              `text-[10px] tracking-widest uppercase transition ${
                isActive
                  ? "text-accent-600"
                  : "text-ink-400 hover:text-accent-600"
              }`
            }
          >
            v0.4.1
          </NavLink>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "text-ink-900"
                  : "text-ink-500 hover:text-ink-900"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {item.label}
                {isActive && (
                  <span className="absolute left-4 right-4 -bottom-[1px] h-[2px] bg-accent-500 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
