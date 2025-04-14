import express from "express";
import multer  from "multer";
import csv     from "csv-parser";
import fs      from "fs";
import pkg from "pg";
const { Pool } = pkg;
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";



const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);



// create postgeSQL connection 
const pool = new Pool({
  host:     process.env.POSTGRES_HOST || "postgres-service",
  database: process.env.POSTGRES_DB   || "rviz",
  user:     process.env.POSTGRES_USER || "rviz",
  password: process.env.POSTGRES_PASS || "rvizpass",
  port: 5432,
});

/// MAkes sure the table expsists
await pool.query(`CREATE TABLE IF NOT EXISTS lab_results (
  id SERIAL PRIMARY KEY,
  date DATE,
  experiment TEXT,
  temperature_c REAL,
  ph REAL,
  observation TEXT
)`);

const app = express();


const upload = multer({ dest: "/data" }); 
app.use(cors());
app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (!req.file.originalname.endsWith(".csv"))
    return res.status(400).json({ error: "Only CSV files allowed" });

  const rows = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      const client = await pool.connect();
      try {
        for (const r of rows) {
          await client.query(
            "INSERT INTO lab_results(date,experiment,temperature_c,ph,observation) VALUES ($1,$2,$3,$4,$5)",
            [r.Date, r.Experiment, r["Temperature (C)"], r.pH, r.Observation]
          );
        }
        res.json({ status: "success", rows: rows.length });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "DB insert failed" });
      } finally {
        client.release();
      }
    });
});

app.get("/data", async (req, res) => {
    try {
      const client = await pool.connect();
      const result = await client.query("SELECT * FROM lab_results ORDER BY id DESC");
      client.release();
  
      const rows = result.rows;
  
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Lab Results</title>
          <style>
            body {
              font-family: sans-serif;
              padding: 2rem;
              background: #f7f7f7;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            th, td {
              padding: 12px 16px;
              border-bottom: 1px solid #eee;
              text-align: left;
            }
            th {
              background-color: #f0f0f0;
            }
          </style>
        </head>
        <body>
          <h1>Lab Results</h1>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Experiment</th>
                <th>Temperature (°C)</th>
                <th>pH</th>
                <th>Observation</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td>${row.id}</td>
                  <td>${row.date ? new Date(row.date).toISOString().split("T")[0] : ""}</td>
                  <td>${row.experiment}</td>
                  <td>${row.temperature_c}</td>
                  <td>${row.ph}</td>
                  <td>${row.observation}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
        </html>
      `;
  
      res.send(html);
    } catch (err) {
      console.error(err);
      res.status(500).send("Error retrieving data");
    }
  });
  
  

app.get("/healthz", (_req, res) => res.send("ok"));

app.listen(8000, () => console.log("Express server running on :8000"));