import {
    Loader2
} from "lucide-react";
import {
    forwardRef
} from "react";

const cx = (...classes) =>
    classes.filter(Boolean).join(" ");

const BUTTON_VARIANTS = {
    primary:
        "border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 focus-visible:ring-blue-200",
    secondary:
        "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-200",
    subtle:
        "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 focus-visible:ring-slate-200",
    ghost:
        "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-200",
    danger:
        "border-transparent bg-transparent text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-rose-200",
    dangerSolid:
        "border-rose-600 bg-rose-600 text-white hover:border-rose-700 hover:bg-rose-700 focus-visible:ring-rose-200",
    success:
        "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 focus-visible:ring-emerald-200",
    warning:
        "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100 focus-visible:ring-amber-200"
};

const BUTTON_SIZES = {
    sm: "h-9 px-3.5 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-sm"
};

const ICON_SIZES = {
    sm: "h-9 w-9",
    md: "h-10 w-10",
    lg: "h-11 w-11"
};

export const Button = forwardRef(
    function Button(
        {
            children,
            className = "",
            variant = "primary",
            size = "md",
            loading = false,
            leftIcon: LeftIcon,
            rightIcon: RightIcon,
            disabled,
            type = "button",
            ...props
        },
        ref
    ) {
        const isDisabled =
            Boolean(disabled || loading);

        return (
            <button
                ref={ref}
                type={type}
                disabled={isDisabled}
                className={cx(
                    "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border font-semibold shadow-sm transition-all duration-150",
                    "focus:outline-none focus-visible:ring-4",
                    "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
                    "active:translate-y-px",
                    BUTTON_VARIANTS[variant] ||
                        BUTTON_VARIANTS.primary,
                    BUTTON_SIZES[size] ||
                        BUTTON_SIZES.md,
                    className
                )}
                {...props}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : LeftIcon ? (
                    <LeftIcon className="h-4 w-4" />
                ) : null}

                {children}

                {!loading && RightIcon ? (
                    <RightIcon className="h-4 w-4" />
                ) : null}
            </button>
        );
    }
);

export const IconButton = forwardRef(
    function IconButton(
        {
            label,
            icon: Icon,
            className = "",
            variant = "ghost",
            size = "md",
            loading = false,
            disabled,
            type = "button",
            ...props
        },
        ref
    ) {
        const isDisabled =
            Boolean(disabled || loading);

        return (
            <button
                ref={ref}
                type={type}
                title={label}
                aria-label={label}
                disabled={isDisabled}
                className={cx(
                    "inline-flex shrink-0 items-center justify-center rounded-xl border shadow-none transition-all duration-150",
                    "focus:outline-none focus-visible:ring-4",
                    "disabled:cursor-not-allowed disabled:opacity-40",
                    "active:translate-y-px",
                    BUTTON_VARIANTS[variant] ||
                        BUTTON_VARIANTS.ghost,
                    ICON_SIZES[size] ||
                        ICON_SIZES.md,
                    className
                )}
                {...props}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : Icon ? (
                    <Icon className="h-5 w-5" />
                ) : null}
            </button>
        );
    }
);

export function ActionGroup({
    children,
    className = ""
}) {
    return (
        <div
            className={cx(
                "inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm",
                className
            )}
        >
            {children}
        </div>
    );
}
