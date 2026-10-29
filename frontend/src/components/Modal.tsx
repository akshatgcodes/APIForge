import { useEffect, useRef, type ReactNode } from "react";

/** A native <dialog>: focus trapping, Escape and the backdrop come for free. */
export default function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // No close() in cleanup: it fires an async "close" event, which in StrictMode's
    // mount-unmount-mount would call onClose right after opening. Unmounting the
    // element is enough to take it off screen.
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
