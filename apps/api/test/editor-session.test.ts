import { describe, expect, it } from "vitest";
import { EditorSession, SerialEditorSaveQueue } from "@studio/contracts";

describe("editor session", () => {
  it("keeps newer draft when an older save response arrives", () => {
    const session = new EditorSession({ revision: 1, document: { value: 1 } });
    session.edit(() => ({ value: 2 }));
    const ticket = session.beginSave();
    session.edit(() => ({ value: 3 }));
    session.resolveSave(ticket, { revision: 2, document: { value: 2 } });
    expect(session.draft.value).toBe(3);
    expect(session.serverSnapshot).toEqual({
      revision: 2,
      document: { value: 2 },
    });
    expect(session.status).toBe("dirty");
  });

  it("supports undo and redo without refetch resetting a dirty draft", () => {
    const session = new EditorSession({ revision: 1, document: { value: 1 } });
    session.edit(() => ({ value: 2 }));
    expect(session.undo()).toBe(true);
    expect(session.draft.value).toBe(1);
    expect(session.redo()).toBe(true);
    expect(session.draft.value).toBe(2);
    expect(
      session.acceptServerSnapshot({ revision: 2, document: { value: 9 } }),
    ).toBe(false);
    expect(session.draft.value).toBe(2);
  });

  it("serializes saves and follows a changed draft with another save", async () => {
    const session = new EditorSession({ revision: 1, document: { value: 1 } });
    const calls: number[] = [];
    let releaseFirst!: () => void;
    const first = new Promise<void>((resolve) => (releaseFirst = resolve));
    const queue = new SerialEditorSaveQueue(
      session,
      async (ticket) => {
        calls.push(ticket.document.value);
        if (calls.length === 1) await first;
        return { revision: ticket.revision + 1, document: ticket.document };
      },
      0,
    );
    queue.edit(() => ({ value: 2 }));
    const saving = queue.flush();
    queue.edit(() => ({ value: 3 }));
    releaseFirst();
    await saving;
    expect(calls).toEqual([2, 3]);
    expect(session.status).toBe("saved");
    expect(session.serverSnapshot.document.value).toBe(3);
    queue.dispose();
  });
});
