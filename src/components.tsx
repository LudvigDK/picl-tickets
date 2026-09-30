import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, X } from "lucide-react";

export function Pickle({
  className = "",
  playful = false,
}: {
  className?: string;
  playful?: boolean;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 100"
      fill="none"
      aria-hidden="true"
    >
      <g transform="rotate(25 40 50)">
        <rect x="18" y="9" width="44" height="82" rx="22" fill="currentColor" />
        <path
          d="M30 23c-5 13-5 37 0 50"
          stroke="var(--pickle-highlight, #a5c776)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <g fill="var(--pickle-dots, #244735)">
          <ellipse cx="49" cy="24" rx="2.4" ry="3" />
          <ellipse cx="43" cy="42" rx="2.4" ry="3" />
          <ellipse cx="53" cy="56" rx="2.4" ry="3" />
          <ellipse cx="45" cy="76" rx="2.4" ry="3" />
        </g>
        {playful && (
          <>
            <path
              d="M30 47h1m15 0h1"
              stroke="#244735"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M34 57q5 6 10 0"
              stroke="#244735"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </>
        )}
      </g>
    </svg>
  );
}

export function Header({ active = "create" }: { active?: "create" | "event" }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <a className="brand" href="#/create" aria-label="Picl Events home">
          <span className="brand-mark">
            <Pickle />
          </span>
          <span>
            picl<span className="brand-dot">.</span>
          </span>
          <span className="brand-divider" />
          <span className="brand-section">events</span>
        </a>
        <nav aria-label="Main navigation">
          <a
            className={active === "create" ? "nav-link active" : "nav-link"}
            href="#/create"
          >
            Create an event
          </a>
          <a
            className="parent-link"
            href="https://picl.dk"
            target="_blank"
            rel="noreferrer"
          >
            picl.dk <ArrowUpRight size={15} />
          </a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <span>
        <Pickle /> A little more together.
      </span>
      <span>
        Made with a little picl love <span aria-hidden="true">✳</span>
      </span>
    </footer>
  );
}

export function SectionHeading({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="section-heading">
      <span className="section-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      aria-labelledby="modal-title"
    >
      <button
        className="icon-button modal-close"
        aria-label="Close dialog"
        onClick={onClose}
      >
        <X size={20} />
      </button>
      <h2 id="modal-title">{title}</h2>
      {children}
    </dialog>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <div className="error-message" role="alert">
      {message}
    </div>
  ) : null;
}
