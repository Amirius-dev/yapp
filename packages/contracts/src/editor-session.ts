export type EditorSaveStatus =
  "saved" | "dirty" | "saving" | "failed" | "conflict";

export type EditorSnapshot<T> = { revision: number; document: T };

type SaveTicket<T> = EditorSnapshot<T> & { localVersion: number };

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class EditorSession<T> {
  serverSnapshot: EditorSnapshot<T>;
  draft: T;
  status: EditorSaveStatus = "saved";
  error: string | null = null;
  private localVersion = 0;
  private history: T[] = [];
  private future: T[] = [];

  constructor(
    snapshot: EditorSnapshot<T>,
    private readonly historyLimit = 80,
  ) {
    this.serverSnapshot = clone(snapshot);
    this.draft = clone(snapshot.document);
  }

  get isDirty() {
    return this.status !== "saved";
  }

  get canUndo() {
    return this.history.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  edit(change: (document: T) => T) {
    this.history.push(clone(this.draft));
    if (this.history.length > this.historyLimit) this.history.shift();
    this.future = [];
    this.draft = clone(change(clone(this.draft)));
    this.localVersion += 1;
    this.status = "dirty";
    this.error = null;
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.future.push(clone(this.draft));
    this.draft = previous;
    this.localVersion += 1;
    this.status = "dirty";
    return true;
  }

  redo() {
    const next = this.future.pop();
    if (!next) return false;
    this.history.push(clone(this.draft));
    this.draft = next;
    this.localVersion += 1;
    this.status = "dirty";
    return true;
  }

  beginSave(): SaveTicket<T> {
    this.status = "saving";
    this.error = null;
    return {
      revision: this.serverSnapshot.revision,
      document: clone(this.draft),
      localVersion: this.localVersion,
    };
  }

  resolveSave(ticket: SaveTicket<T>, snapshot: EditorSnapshot<T>) {
    this.serverSnapshot = clone(snapshot);
    if (ticket.localVersion === this.localVersion) {
      this.draft = clone(snapshot.document);
      this.status = "saved";
    } else {
      this.status = "dirty";
    }
    this.error = null;
  }

  rejectSave(error: unknown, conflict = false) {
    this.status = conflict ? "conflict" : "failed";
    this.error =
      error instanceof Error
        ? error.message
        : "Не удалось сохранить изменения.";
  }

  acceptServerSnapshot(snapshot: EditorSnapshot<T>) {
    if (this.isDirty) return false;
    this.serverSnapshot = clone(snapshot);
    this.draft = clone(snapshot.document);
    this.history = [];
    this.future = [];
    return true;
  }
}

export class SerialEditorSaveQueue<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private saveRequested = false;

  constructor(
    readonly session: EditorSession<T>,
    private readonly save: (
      ticket: SaveTicket<T>,
    ) => Promise<EditorSnapshot<T>>,
    private readonly debounceMs = 700,
  ) {}

  edit(change: (document: T) => T) {
    this.session.edit(change);
    this.requestSave();
  }

  requestSave() {
    this.saveRequested = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.saveRequested = true;
    if (!this.running)
      this.running = this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run() {
    while (this.saveRequested && this.session.isDirty) {
      this.saveRequested = false;
      const ticket = this.session.beginSave();
      try {
        const snapshot = await this.save(ticket);
        this.session.resolveSave(ticket, snapshot);
        if (this.session.status === "dirty") this.saveRequested = true;
      } catch (error) {
        const conflict =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "EDITOR_REVISION_CONFLICT";
        this.session.rejectSave(error, conflict);
        break;
      }
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
