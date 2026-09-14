import { NextRequest, NextResponse } from "next/server";
import * as store from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("docId");

  if (!docId) {
    return NextResponse.json({ error: "docId required" }, { status: 400 });
  }

  const deleted = store.deleteDoc(docId);
  return NextResponse.json({ deleted });
}
