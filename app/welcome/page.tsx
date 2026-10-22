import Link from "next/link";
import { ArrowRight, Route, ShieldCheck, Truck, Boxes } from "lucide-react";
export default function Welcome() {
  return (
    <main className="verify-shell" style={{ width: "auto" }}>
      <Link className="brand" href="/">
        <Route size={29} />
        SecondRoute<span className="brand-dot">.</span>
      </Link>
      <section className="panel">
        <span className="eyebrow">
          GIVING DISCARDED MATERIALS ANOTHER DESTINATION.
        </span>
        <h1>
          The event ends.
          <br />
          The material&apos;s story continues.
        </h1>
        <p style={{ margin: "20px 0", color: "#718367" }}>
          Record useful materials, coordinate their next destination, and follow
          what a recovery partner actually received.
        </p>
        <div className="info-strip">
          <Boxes size={23} />
          <div>
            <strong>Capture. Dispatch. Receive. Verify.</strong>
            <p>
              A desktop workspace for material recovery, with sample records to
              explore.
            </p>
          </div>
        </div>
        <Link className="primary" href="/">
          Open workspace
          <ArrowRight size={17} />
        </Link>
        <div className="info-strip">
          <ShieldCheck size={23} />
          <div>
            <strong>Your workspace starts with you</strong>
            <p>
              Create an email account to manage your own events, materials and
              recovery partners.
            </p>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#879678" }}>
          <Truck
            size={16}
            style={{
              display: "inline",
              verticalAlign: "middle",
              marginRight: 6,
            }}
          />
          A captured material is not a recovered material. Recipient acceptance
          and coordinator review determine reported recovery.
        </p>
      </section>
    </main>
  );
}
