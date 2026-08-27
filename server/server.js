const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const SERVICE_ZIPS = {"30110":"Bremen","30117":"Carrollton","30179":"Temple","30180":"Villa Rica","30134":"Douglasville","30135":"Douglasville","30132":"Dallas","30125":"Cedartown","30263":"Newnan","30265":"Newnan"};
const PRICE = {"Sell My House Fast":125,"Roofing":65,"HVAC":50,"Concrete":45,"Tree Removal":40,"Electrical":50,"Drywall Finishing":35,"Painting":35,"Plumbing":50};

app.get("/health",(req,res)=>res.json({ok:true,supabaseConfigured:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY)}));

app.post("/api/leads", async (req,res)=>{
  try{
    const b=req.body||{};
    for(const k of ["service","zip","name","phone","email"]) if(!String(b[k]||"").trim()) return res.status(400).json({ok:false,error:`Missing ${k}`});
    const row={
      service:String(b.service).trim(), project_type:String(b.project||"").trim()||null,
      timeline:String(b.timeline||"").trim()||null, zip_code:String(b.zip).trim(),
      city:String(b.city||SERVICE_ZIPS[String(b.zip).trim()]||"").trim()||null,
      address:String(b.address||"").trim()||null, details:String(b.details||"").trim()||null,
      customer_name:String(b.name).trim(), phone:String(b.phone).trim(), email:String(b.email).trim(),
      lead_value:Number(PRICE[b.service]||0), status:"new"
    };
    const {data,error}=await supabase.from("leads").insert(row).select("id,created_at").single();
    if(error) throw error;
    await supabase.from("lead_status_history").insert({lead_id:data.id,status:"new",notes:"Lead received from website."});
    res.json({ok:true,lead_id:data.id});
  }catch(e){console.error(e);res.status(500).json({ok:false,error:"Unable to save lead."});}
});

app.post("/api/partners", async (req,res)=>{
  try{
    const b=req.body||{};
    for(const k of ["business","name","phone","email","service"]) if(!String(b[k]||"").trim()) return res.status(400).json({ok:false,error:`Missing ${k}`});
    const row={business_name:b.business.trim(),contact_name:b.name.trim(),phone:b.phone.trim(),email:b.email.trim(),service:b.service.trim(),plan_type:String(b.plan||"Pay Per Lead"),active:false,exclusive:String(b.plan||"").toLowerCase().includes("exclusive")};
    const {data,error}=await supabase.from("contractors").insert(row).select("id").single();
    if(error) throw error;
    res.json({ok:true,contractor_id:data.id});
  }catch(e){console.error(e);res.status(500).json({ok:false,error:"Unable to save partner application."});}
});

function admin(req,res,next){
  if(!ADMIN_KEY) return res.status(503).json({ok:false,error:"ADMIN_KEY not configured"});
  if((req.get("x-admin-key")||"")!==ADMIN_KEY) return res.status(401).json({ok:false,error:"Unauthorized"});
  next();
}

app.get("/api/admin/leads",admin,async(req,res)=>{
  const {data,error}=await supabase.from("leads").select("*").order("created_at",{ascending:false}).limit(200);
  if(error) return res.status(500).json({ok:false,error:error.message});
  res.json({ok:true,leads:data||[]});
});

app.get("/api/admin/partners",admin,async(req,res)=>{
  const {data,error}=await supabase.from("contractors").select("*").order("created_at",{ascending:false}).limit(200);
  if(error) return res.status(500).json({ok:false,error:error.message});
  res.json({ok:true,partners:data||[]});
});

app.listen(process.env.PORT||3000,()=>console.log("WGHS server running"));
