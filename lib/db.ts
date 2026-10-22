import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
const globalDb = globalThis as unknown as { secondrouteDb?: Promise<PGlite> };
export const dataDir = () =>
  process.env.SECONDROUTE_DATA_DIR || path.join(process.cwd(), ".data");
export function db(): Promise<PGlite> {
  return (globalDb.secondrouteDb ||= (async () => {
    await mkdir(dataDir(), { recursive: true });
    const database = new PGlite(path.join(dataDir(), "postgres"));
    await database.exec(
      await readFile(
        path.join(process.cwd(), "migrations/001_core.sql"),
        "utf8",
      ),
    );
    const existing = await database.query(
      "SELECT id FROM organizations LIMIT 1",
    );
    if (!existing.rows.length) await seed(database);
    return database;
  })());
}
export async function seed(database: PGlite) {
  await database.transaction(async (tx) => {
    await tx.exec(`INSERT INTO organizations VALUES ('demo-org','SecondRoute Demonstration');
   INSERT INTO events VALUES ('riverlight','demo-org','Riverlight Festival','Bengaluru Lakeside Grounds','2026-10-22','Active');
   INSERT INTO events VALUES ('design-week','demo-org','Circular Design Week','Bengaluru Exhibition Hall','2026-10-24','Planning');
   INSERT INTO zones VALUES ('north','demo-org','riverlight','North entrance',28,25),('food','demo-org','riverlight','Food court',65,42),('stage','demo-org','riverlight','Main stage',45,65),('market','demo-org','riverlight','Market lane',76,74),('hall','demo-org','design-week','Exhibition hall',50,50);
   INSERT INTO partners VALUES ('paper-loop','demo-org','Paper Loop Collective','["Cardboard","Paper"]',600,true,4.2),('metalworks','demo-org','Renew Metalworks','["Aluminum"]',400,true,6.8),('reuse-studio','demo-org','Again Studio','["Reusable fixtures","Signage"]',350,true,3.1),('poly-cycle','demo-org','PolyCycle Works','["PET bottles"]',500,true,8.4);
   INSERT INTO batches(id,org_id,event_id,zone_id,material,weight,status,partner_id,accepted,rejected,evidence,notes) VALUES
    ('SR-1041','demo-org','riverlight','north','Cardboard',128,'Ready',null,0,0,null,'Clean, flattened vendor cartons'),
    ('SR-1042','demo-org','riverlight','food','PET bottles',84,'Assigned','poly-cycle',0,0,null,'Bagged and dry'),
    ('SR-1043','demo-org','riverlight','stage','Aluminum',46,'Collected','metalworks',0,0,null,'Collected by Crew B'),
    ('SR-1044','demo-org','riverlight','market','Reusable fixtures',210,'Received','reuse-studio',192,18,'demo-receipt-fixtures','Recipient reports 18 kg damaged fixtures. Fictional demonstration receipt.'),
    ('SR-1045','demo-org','riverlight','food','Cardboard',72,'Verified','paper-loop',68,4,'demo-receipt-paper','Fictional seed attestation reviewed for demo only'),
    ('SR-1046','demo-org','riverlight','stage','Signage',32,'Ready',null,0,0,null,'Reusable panels with removable vinyl');
   INSERT INTO captures(id,org_id,event_id,zone_id,batch_id,material,weight,provenance,quantity,notes) SELECT 'capture-'||id,org_id,event_id,zone_id,id,material,weight,'estimated',1,notes FROM batches;
   INSERT INTO custody_events(id,org_id,batch_id,action,role,details) SELECT 'custody-'||id,org_id,id,'Seeded demonstration record','admin','{"fictional":true}' FROM batches;
   INSERT INTO receipts(id,org_id,batch_id,accepted,rejected,evidence,notes) SELECT 'receipt-'||id,org_id,id,accepted,rejected,evidence,notes FROM batches WHERE status IN ('Received','Verified');`);
  });
}
