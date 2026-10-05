import React, { useId, useEffect, useRef } from "react";
import { X, ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../../public/icons/icon-192x192.png";
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="ALP workspace">
      <img src={logo} alt="" width="44" height="44" />
      <span>
        <strong>ALP</strong>
        <small>Accelerated Learning Plan</small>
      </span>
    </Link>
  );
}
export function Credit() {
  return (
    <footer className="credit">
      Built by{" "}
      <a
        href="https://www.stanparaclete.com/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Stan Paraclete
      </a>
    </footer>
  );
}
export function Button({ children, icon: Icon, secondary = false, ...props }) {
  return (
    <button
      type="button"
      className={secondary ? "button secondary" : "button"}
      {...props}
    >
      {Icon ? <Icon size={18} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
export function IconButton({ label, icon: Icon, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
export function Field({ label, multiline = false, children, ...props }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {children ? (
        <select id={id} {...props}>
          {children}
        </select>
      ) : multiline ? (
        <textarea id={id} rows={8} {...props} />
      ) : (
        <input id={id} {...props} />
      )}
    </label>
  );
}
export function ErrorText({ children }) {
  return children ? (
    <div className="error" role="alert">
      {children}
    </div>
  ) : null;
}
export function Status({ resource }) {
  return (
    <>
      {resource.loading ? (
        <p className="loading" role="status">
          <LoaderCircle size={18} className="spin" />
          Loading...
        </p>
      ) : null}
      <ErrorText>{resource.error}</ErrorText>
      {resource.error ? (
        <Button secondary onClick={resource.reload}>
          Try again
        </Button>
      ) : null}
    </>
  );
}
export function Heading({ eyebrow, title, children }) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 tabIndex="-1">{title}</h1>
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}
export function Badge({ children }) {
  return <span className="badge">{String(children).replaceAll("_", " ")}</span>;
}
export function Pager({ offset, total, onChange }) {
  return (
    <div className="pager">
      <span>
        {total
          ? `${offset + 1}-${Math.min(offset + 50, total)} of ${total}`
          : "0 results"}
      </span>
      <IconButton
        label="Previous page"
        icon={ArrowLeft}
        disabled={!offset}
        onClick={() => onChange(Math.max(0, offset - 50))}
      />
      <IconButton
        label="Next page"
        icon={ArrowRight}
        disabled={offset + 50 >= total}
        onClick={() => onChange(offset + 50)}
      />
    </div>
  );
}
export function Dialog({ title, onClose, children }) {
  const ref = useRef(),
    id = useId(),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
    >
      <header className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <IconButton label="Close dialog" icon={X} onClick={onClose} />
      </header>
      {children}
    </dialog>
  );
}
export const dateText = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Not set";
