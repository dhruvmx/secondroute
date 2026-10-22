import { roleFor, errorResponse } from "../../../lib/auth";
import { state } from "../../../lib/service";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    roleFor(request);
    const url = new URL(request.url);
    const s = await state(url.searchParams.get("event"), {
      zone: url.searchParams.get("zone"),
      status: url.searchParams.get("status"),
      search: url.searchParams.get("search"),
    });
    const rows = [
      [
        "Batch",
        "Material",
        "Zone",
        "Claimed kg",
        "Status",
        "Accepted kg",
        "Rejected kg",
        "Recovered kg",
      ],
      ...s.batches.map((b) => [
        b.id,
        b.material,
        s.zones.find((z) => z.id === b.zone_id)?.name || b.zone_id,
        b.weight,
        b.status,
        b.accepted,
        b.rejected,
        b.status === "Verified" ? b.accepted : 0,
      ]),
      ...s.captures
        .filter((c) => !c.batch_id)
        .map((c) => [
          c.id,
          c.material,
          s.zones.find((z) => z.id === c.zone_id)?.name || c.zone_id,
          c.weight,
          "Review required",
          0,
          0,
          0,
        ]),
    ];
    if (url.searchParams.get("format") !== "pdf") {
      const csv = rows
        .map((r) =>
          r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
        )
        .join("\r\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition":
            'attachment; filename="secondroute-report.csv"',
        },
      });
    }
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let page = pdf.addPage([842, 595]);
    let y = 555;
    const line = (value: string, size = 11) => {
      if (y < 45) {
        page = pdf.addPage([842, 595]);
        y = 555;
      }
      page.drawText(value, {
        x: 40,
        y,
        size,
        font,
        color: rgb(0.1, 0.2, 0.16),
      });
      y -= size + 12;
    };
    line("SecondRoute | Recovery report", 24);
    line("Fictional demonstration data. Generated " + new Date().toISOString());
    line(
      `Captured: ${s.metrics.captured} kg | Recipient-confirmed recovery: ${s.metrics.recovered} kg | Rejected: ${s.metrics.rejected} kg`,
      13,
    );
    line(
      "Recovery counts only accepted weight in coordinator-verified recipient receipts.",
    );
    line(
      "Emissions estimates unavailable: no validated geography and pathway factors configured.",
    );
    y -= 10;
    for (const row of rows) line(row.join(" | "), 9);
    line(
      "Signatures prove attestations and detect changes. They do not establish physical truth.",
      10,
    );
    return new Response(Buffer.from(await pdf.save()), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="secondroute-report.pdf"',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
