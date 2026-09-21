import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import {
  getImportRemindDays,
  isOnboardingDismissed,
  setImportRemindDays,
  setOnboardingDismissed,
} from "@/lib/settings";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({
      import_remind_days: getImportRemindDays(),
      onboarding_dismissed: isOnboardingDismissed(user.id),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Settings failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const out: Record<string, unknown> = {};

    if (body.import_remind_days !== undefined) {
      if (user.role !== "owner") {
        return NextResponse.json(
          { error: "Only owners can change import reminder" },
          { status: 403 }
        );
      }
      out.import_remind_days = setImportRemindDays(
        Number(body.import_remind_days)
      );
    }

    if (body.onboarding_dismissed !== undefined) {
      const dismissed = !!body.onboarding_dismissed;
      setOnboardingDismissed(user.id, dismissed);
      out.onboarding_dismissed = dismissed;
    }

    if (Object.keys(out).length === 0) {
      return NextResponse.json({ error: "No settings to update" }, { status: 400 });
    }

    return NextResponse.json({
      ...out,
      import_remind_days:
        (out.import_remind_days as number | undefined) ?? getImportRemindDays(),
      onboarding_dismissed:
        (out.onboarding_dismissed as boolean | undefined) ??
        isOnboardingDismissed(user.id),
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Settings update failed" }, { status: 500 });
  }
}
