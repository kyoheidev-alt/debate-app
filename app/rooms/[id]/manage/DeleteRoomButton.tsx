"use client";

import { useTransition } from "react";
import { deleteRoom } from "./actions";

export function DeleteRoomButton({ roomId }: { roomId: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (
      !confirm(
        "このルームを削除します。すべてのメッセージとスタンスが消去され、元に戻せません。よろしいですか？",
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteRoom(roomId);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="btn-danger self-start"
    >
      {pending ? "削除中…" : "ルームを削除"}
    </button>
  );
}
