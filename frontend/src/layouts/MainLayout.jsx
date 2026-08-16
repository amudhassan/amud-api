import {
    useState
} from "react";

import {
    Outlet,
    useLocation
} from "react-router-dom";

import Sidebar from "../components/layout/Sidebar";
import Topbar from "../components/layout/Topbar";

const getInitialSidebarCollapsed = () => {
    try {
        return (
            window.localStorage.getItem(
                "rental_manager_sidebar_collapsed"
            ) === "true"
        );
    } catch {
        return false;
    }
};

const SECTION_ACCENTS = {
    dashboard: "37 99 235",
    users: "79 70 229",
    owners: "8 145 178",
    properties: "29 78 216",
    units: "13 148 136",
    tenants: "5 150 105",
    leases: "217 119 6",
    invoices: "234 88 12",
    payments: "22 163 74",
    maintenance: "225 29 72",
    notifications: "147 51 234",
    reports: "2 132 199",
    settings: "71 85 105"
};

const getSectionVisualContext = pathname => {
    const section =
        String(pathname || "")
            .split("/")
            .filter(Boolean)[0] ||
        "dashboard";

    return {
        section,
        accent:
            SECTION_ACCENTS[section] ||
            SECTION_ACCENTS.dashboard
    };
};

function AmbientBackground() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        >
            <div
                className="absolute inset-0"
                style={{
                    background:
                        "linear-gradient(135deg, #f8fafc 0%, #eff6ff 42%, #f8fafc 70%, #f5f3ff 100%)"
                }}
            />

            <div
                className="rental-ambient-orb rental-ambient-orb-one absolute -left-24 -top-28 h-[30rem] w-[30rem] rounded-full blur-3xl"
                style={{
                    background:
                        "radial-gradient(circle, rgba(37,99,235,0.20) 0%, rgba(96,165,250,0.08) 46%, rgba(255,255,255,0) 72%)"
                }}
            />

            <div
                className="rental-ambient-orb rental-ambient-orb-two absolute -right-40 top-[18%] h-[34rem] w-[34rem] rounded-full blur-3xl"
                style={{
                    background:
                        "radial-gradient(circle, rgba(124,58,237,0.14) 0%, rgba(167,139,250,0.06) 48%, rgba(255,255,255,0) 72%)"
                }}
            />

            <div
                className="rental-ambient-orb rental-ambient-orb-three absolute bottom-[-14rem] left-[28%] h-[32rem] w-[32rem] rounded-full blur-3xl"
                style={{
                    background:
                        "radial-gradient(circle, rgba(14,165,233,0.12) 0%, rgba(125,211,252,0.05) 46%, rgba(255,255,255,0) 72%)"
                }}
            />

            <div
                className="absolute inset-0 opacity-[0.28]"
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(148,163,184,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.13) 1px, transparent 1px)",
                    backgroundSize: "42px 42px",
                    maskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 72%)",
                    WebkitMaskImage:
                        "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 72%)"
                }}
            />

            <svg
                viewBox="0 0 640 260"
                className="rental-skyline absolute bottom-0 right-0 hidden w-[42rem] max-w-[48vw] text-blue-950/[0.045] xl:block"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
            >
                <path d="M20 240V150h84v90M48 150v-42h28v42M128 240V92h104v148M154 122h22M190 122h22M154 152h22M190 152h22M154 182h22M190 182h22M260 240V132h72v108M282 156h28M282 184h28M360 240V66h112v174M388 98h24M432 98h24M388 132h24M432 132h24M388 166h24M432 166h24M504 240V118h96v122M530 148h20M566 148h20M530 180h20M566 180h20" />
                <path d="M0 240H640" />
            </svg>

            <div
                className="absolute inset-x-0 top-0 h-64"
                style={{
                    background:
                        "linear-gradient(to bottom, rgba(255,255,255,0.48), rgba(255,255,255,0))"
                }}
            />
        </div>
    );
}

function MainLayout() {
    const location = useLocation();
    const sectionVisualContext =
        getSectionVisualContext(
            location.pathname
        );

    const [
        sidebarOpen,
        setSidebarOpen
    ] = useState(false);

    const [
        sidebarCollapsed,
        setSidebarCollapsed
    ] = useState(
        getInitialSidebarCollapsed
    );

    const openSidebar = () => {
        setSidebarOpen(true);
    };

    const closeSidebar = () => {
        setSidebarOpen(false);
    };

    const toggleSidebarCollapsed = () => {
        setSidebarCollapsed(current => {
            const next = !current;

            try {
                window.localStorage.setItem(
                    "rental_manager_sidebar_collapsed",
                    String(next)
                );
            } catch {
                // The sidebar still works if localStorage is unavailable.
            }

            return next;
        });
    };

    return (
        <div className="rental-app-shell relative isolate min-h-screen overflow-x-hidden bg-slate-50">
            <style>{`
                @keyframes rentalAmbientOne {
                    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
                    50% { transform: translate3d(42px, 26px, 0) scale(1.08); }
                }

                @keyframes rentalAmbientTwo {
                    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
                    50% { transform: translate3d(-36px, 34px, 0) scale(1.06); }
                }

                @keyframes rentalAmbientThree {
                    0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
                    50% { transform: translate3d(24px, -30px, 0) scale(1.05); }
                }

                @keyframes rentalPageEnter {
                    from {
                        opacity: 0;
                        transform: translate3d(0, 10px, 0);
                    }
                    to {
                        opacity: 1;
                        transform: translate3d(0, 0, 0);
                    }
                }

                @keyframes rentalSkylineFloat {
                    0%, 100% { transform: translate3d(0, 0, 0); }
                    50% { transform: translate3d(0, -7px, 0); }
                }

                .rental-ambient-orb-one {
                    animation: rentalAmbientOne 18s ease-in-out infinite;
                }

                .rental-ambient-orb-two {
                    animation: rentalAmbientTwo 22s ease-in-out infinite;
                }

                .rental-ambient-orb-three {
                    animation: rentalAmbientThree 20s ease-in-out infinite;
                }

                .rental-skyline {
                    animation: rentalSkylineFloat 12s ease-in-out infinite;
                }

                .rental-page-enter {
                    animation: rentalPageEnter 420ms cubic-bezier(.22,1,.36,1) both;
                }

                @keyframes rentalSectionReveal {
                    from {
                        opacity: 0;
                        transform: translate3d(0, 14px, 0);
                    }
                    to {
                        opacity: 1;
                        transform: translate3d(0, 0, 0);
                    }
                }

                @keyframes rentalModalReveal {
                    from {
                        opacity: 0;
                        transform: translate3d(0, 8px, 0) scale(.985);
                    }
                    to {
                        opacity: 1;
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                }

                @keyframes rentalAccentSweep {
                    0% { transform: translateX(-120%); opacity: 0; }
                    35% { opacity: .9; }
                    100% { transform: translateX(220%); opacity: 0; }
                }

                .rental-section-effects {
                    --rental-section-rgb: 37 99 235;
                    --rental-soft-shadow:
                        0 18px 45px -28px
                        rgb(var(--rental-section-rgb) / .45);
                }

                .rental-section-effects > * > * {
                    animation: rentalSectionReveal
                        520ms cubic-bezier(.22,1,.36,1) both;
                }

                .rental-section-effects > * > *:nth-child(2) { animation-delay: 35ms; }
                .rental-section-effects > * > *:nth-child(3) { animation-delay: 70ms; }
                .rental-section-effects > * > *:nth-child(4) { animation-delay: 105ms; }
                .rental-section-effects > * > *:nth-child(5) { animation-delay: 140ms; }
                .rental-section-effects > * > *:nth-child(6) { animation-delay: 175ms; }
                .rental-section-effects > * > *:nth-child(n+7) { animation-delay: 200ms; }

                .rental-section-effects h1 {
                    text-wrap: balance;
                }

                .rental-section-effects h1::selection,
                .rental-section-effects h2::selection,
                .rental-section-effects h3::selection {
                    background:
                        rgb(var(--rental-section-rgb) / .18);
                }

                .rental-section-effects :is(
                    div, section, article
                )[class*="bg-white"][class*="rounded-"][class*="border"] {
                    transition:
                        transform 240ms cubic-bezier(.22,1,.36,1),
                        box-shadow 240ms ease,
                        border-color 240ms ease,
                        background-color 240ms ease;
                    will-change: transform;
                }

                @media (hover: hover) and (pointer: fine) {
                    .rental-section-effects :is(
                        div, section, article
                    )[class*="bg-white"][class*="rounded-"][class*="border"]:not([role="dialog"]):hover {
                        transform: translate3d(0, -3px, 0);
                        border-color:
                            rgb(var(--rental-section-rgb) / .22);
                        box-shadow:
                            0 22px 55px -34px
                            rgb(var(--rental-section-rgb) / .5),
                            0 10px 28px -24px
                            rgb(15 23 42 / .35);
                    }

                    .rental-section-effects button:not(:disabled):hover {
                        transform: translate3d(0, -1px, 0);
                    }

                    .rental-section-effects tbody tr:hover {
                        transform: translate3d(2px, 0, 0);
                    }
                }

                .rental-section-effects button {
                    transition:
                        transform 180ms cubic-bezier(.22,1,.36,1),
                        box-shadow 180ms ease,
                        background-color 180ms ease,
                        border-color 180ms ease,
                        color 180ms ease,
                        opacity 180ms ease;
                }

                .rental-section-effects button:not(:disabled):active {
                    transform: translate3d(0, 0, 0) scale(.975);
                }

                .rental-section-effects button:focus-visible,
                .rental-section-effects a:focus-visible {
                    outline: 2px solid
                        rgb(var(--rental-section-rgb) / .72);
                    outline-offset: 3px;
                }

                .rental-section-effects :is(
                    input, select, textarea
                ) {
                    transition:
                        border-color 180ms ease,
                        box-shadow 180ms ease,
                        background-color 180ms ease;
                }

                .rental-section-effects :is(
                    input, select, textarea
                ):focus {
                    border-color:
                        rgb(var(--rental-section-rgb) / .62);
                    box-shadow:
                        0 0 0 4px
                        rgb(var(--rental-section-rgb) / .10);
                }

                .rental-section-effects table {
                    border-collapse: separate;
                    border-spacing: 0;
                }

                .rental-section-effects tbody tr {
                    transition:
                        transform 180ms ease,
                        background-color 180ms ease,
                        box-shadow 180ms ease;
                }

                .rental-section-effects tbody tr:hover {
                    background-color:
                        rgb(var(--rental-section-rgb) / .035);
                }

                .rental-section-effects :is(
                    [class*="bg-blue-50"],
                    [class*="bg-emerald-50"],
                    [class*="bg-amber-50"],
                    [class*="bg-rose-50"],
                    [class*="bg-violet-50"]
                )[class*="rounded-"] {
                    transition:
                        transform 200ms ease,
                        filter 200ms ease,
                        box-shadow 200ms ease;
                }

                .rental-section-effects [class*="fixed"][class*="inset-0"] {
                    animation: rentalPageEnter
                        180ms ease-out both;
                }

                .rental-section-effects [class*="fixed"][class*="inset-0"]
                > :is(div, section, article)[class*="rounded-"] {
                    animation: rentalModalReveal
                        300ms cubic-bezier(.22,1,.36,1) both;
                }

                .rental-section-effects [data-rental-accent-strip] {
                    position: relative;
                    overflow: hidden;
                }

                .rental-section-effects [data-rental-accent-strip]::after {
                    content: "";
                    position: absolute;
                    inset: 0 auto 0 -25%;
                    width: 18%;
                    pointer-events: none;
                    background:
                        linear-gradient(
                            90deg,
                            transparent,
                            rgb(var(--rental-section-rgb) / .16),
                            transparent
                        );
                    transform: skewX(-14deg);
                    animation: rentalAccentSweep 5.8s ease-in-out infinite;
                }

                .rental-section-effects ::-webkit-scrollbar-thumb {
                    background:
                        rgb(var(--rental-section-rgb) / .25);
                }

                /* ZIP118 - Sidebar premium polish */
                .rental-app-shell > aside {
                    box-shadow:
                        22px 0 60px -42px rgb(15 23 42 / .78);
                    border-right: 1px solid rgb(148 163 184 / .10);
                    background-image:
                        radial-gradient(
                            circle at 20% 4%,
                            rgb(37 99 235 / .12),
                            transparent 28%
                        ),
                        linear-gradient(
                            180deg,
                            rgb(2 6 23) 0%,
                            rgb(2 8 24) 52%,
                            rgb(2 6 23) 100%
                        );
                }

                .rental-app-shell > aside > div:first-child {
                    position: relative;
                    isolation: isolate;
                    overflow: hidden;
                    background:
                        linear-gradient(
                            135deg,
                            rgb(15 23 42 / .72),
                            rgb(2 6 23 / .22)
                        );
                }

                .rental-app-shell > aside > div:first-child::after {
                    content: "";
                    position: absolute;
                    inset: auto -18% -26px 18%;
                    z-index: -1;
                    height: 52px;
                    border-radius: 999px;
                    background: rgb(37 99 235 / .22);
                    filter: blur(28px);
                }

                .rental-app-shell > aside nav a {
                    position: relative;
                    isolation: isolate;
                    overflow: hidden;
                    border: 1px solid transparent;
                    transition:
                        transform 200ms cubic-bezier(.22,1,.36,1),
                        background-color 200ms ease,
                        border-color 200ms ease,
                        color 200ms ease,
                        box-shadow 200ms ease;
                }

                .rental-app-shell > aside nav a::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    z-index: -1;
                    background:
                        linear-gradient(
                            110deg,
                            transparent 12%,
                            rgb(255 255 255 / .08) 46%,
                            transparent 70%
                        );
                    transform: translateX(-125%);
                    transition: transform 520ms ease;
                }

                @media (hover: hover) and (pointer: fine) {
                    .rental-app-shell > aside nav a:hover {
                        transform: translate3d(3px, 0, 0);
                        border-color: rgb(148 163 184 / .12);
                    }

                    .rental-app-shell > aside nav a:hover::after {
                        transform: translateX(125%);
                    }
                }

                .rental-app-shell > aside nav a[class*="bg-blue-600"] {
                    border-color: rgb(147 197 253 / .22);
                    background:
                        linear-gradient(
                            135deg,
                            rgb(37 99 235),
                            rgb(29 78 216)
                        );
                    box-shadow:
                        0 14px 30px -18px rgb(37 99 235 / .95),
                        inset 0 1px 0 rgb(255 255 255 / .18);
                }

                .rental-app-shell > aside nav a[class*="bg-blue-600"]::before {
                    content: "";
                    position: absolute;
                    inset: 18% auto 18% 0;
                    width: 3px;
                    border-radius: 0 999px 999px 0;
                    background: white;
                    box-shadow: 0 0 16px rgb(255 255 255 / .7);
                }

                .rental-app-shell > aside [class*="System Status"] {
                    box-shadow: inset 0 1px 0 rgb(255 255 255 / .04);
                }

                /* ZIP118 - Topbar premium polish */
                .rental-topbar {
                    isolation: isolate;
                }

                .rental-topbar::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    z-index: -1;
                    pointer-events: none;
                    background:
                        radial-gradient(
                            circle at 88% -40%,
                            rgb(var(--rental-section-rgb) / .10),
                            transparent 34%
                        );
                }

                .rental-topbar-control {
                    position: relative;
                    overflow: hidden;
                }

                .rental-topbar-control::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    border-radius: inherit;
                    background:
                        linear-gradient(
                            120deg,
                            transparent 20%,
                            rgb(255 255 255 / .48) 48%,
                            transparent 72%
                        );
                    transform: translateX(-140%);
                    transition: transform 600ms ease;
                }

                @media (hover: hover) and (pointer: fine) {
                    .rental-topbar-control:hover::after {
                        transform: translateX(140%);
                    }
                }

                /* ZIP118 - Tables */
                .rental-section-effects table thead th {
                    background:
                        linear-gradient(
                            180deg,
                            rgb(248 250 252 / .96),
                            rgb(241 245 249 / .86)
                        );
                    color: rgb(71 85 105);
                    font-size: .72rem;
                    letter-spacing: .045em;
                    text-transform: uppercase;
                    box-shadow:
                        inset 0 -1px 0 rgb(226 232 240 / .88);
                }

                .rental-section-effects table tbody td {
                    transition:
                        background-color 180ms ease,
                        color 180ms ease;
                }

                .rental-section-effects table tbody tr:last-child td {
                    border-bottom-color: transparent;
                }

                /* ZIP118 - Modal depth and focus */
                .rental-section-effects [class*="fixed"][class*="inset-0"] {
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                }

                .rental-section-effects [class*="fixed"][class*="inset-0"]
                > :is(div, section, article)[class*="rounded-"] {
                    border-color: rgb(255 255 255 / .72);
                    box-shadow:
                        0 32px 90px -34px rgb(15 23 42 / .42),
                        0 16px 42px -30px
                        rgb(var(--rental-section-rgb) / .46),
                        inset 0 1px 0 rgb(255 255 255 / .82);
                }

                .rental-section-effects [role="dialog"] h1,
                .rental-section-effects [role="dialog"] h2,
                .rental-section-effects [role="dialog"] h3 {
                    letter-spacing: -.018em;
                }

                .rental-section-effects [role="alert"] {
                    animation: rentalSectionReveal
                        300ms cubic-bezier(.22,1,.36,1) both;
                }

                @media (prefers-reduced-motion: reduce) {
                    .rental-ambient-orb,
                    .rental-skyline,
                    .rental-page-enter,
                    .rental-section-effects > * > *,
                    .rental-section-effects [class*="fixed"][class*="inset-0"],
                    .rental-section-effects [class*="fixed"][class*="inset-0"] > *,
                    .rental-section-effects [data-rental-accent-strip]::after {
                        animation: none !important;
                    }

                    .rental-section-effects *,
                    .rental-section-effects *::before,
                    .rental-section-effects *::after {
                        scroll-behavior: auto !important;
                    }
                }
            `}</style>

            <AmbientBackground />

            <Sidebar
                isOpen={sidebarOpen}
                onClose={closeSidebar}
                collapsed={sidebarCollapsed}
                onToggleCollapse={
                    toggleSidebarCollapsed
                }
            />

            <div
                className={`
                    relative z-10 min-h-screen
                    transition-[padding] duration-300
                    ${
                        sidebarCollapsed
                            ? "lg:pl-20"
                            : "lg:pl-72"
                    }
                `}
            >
                <Topbar
                    onMenuClick={openSidebar}
                />

                <main className="relative px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    <div
                        key={location.pathname}
                        data-rental-section={
                            sectionVisualContext.section
                        }
                        className="rental-page-enter rental-section-effects mx-auto max-w-[1600px]"
                        style={{
                            "--rental-section-rgb":
                                sectionVisualContext.accent
                        }}
                    >
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

export default MainLayout;
