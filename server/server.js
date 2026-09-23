const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const ADMIN_KEY = process.env.ADMIN_KEY || "";

const SERVICE_ZIPS = {"30110":"Bremen","30117":"Carrollton","30179":"Temple","30180":"Villa Rica","30134":"Douglasville","30135":"Douglasville","30132":"Dallas","30125":"Cedartown","30263":"Newnan","30265":"Newnan"};
const PRICE = {"Sell My House Fast":125,"Roofing":65,"HVAC":50,"Concrete":45,"Tree Removal":40,"Electrical":50,"Drywall Finishing":35,"Painting":35,"Plumbing":50};



app.get("/contractors", (req,res) => {
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.get("/admin", (req,res) => {
  res.sendFile(path.join(__dirname, "..", "public", "admin.html"));
});

app.get("/health",(req,res)=>res.json({ok:true,supabaseConfigured:Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY)}));

app.get("/version",(req,res)=>res.json({ok:true,build:"WGHS-2026-09-23-MASTER-2"}));

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

app.get("/api/partners",(req,res)=>{
  res.status(405).send("Contractor applications must be submitted by POST. Please return to the website and refresh.");
});

app.post("/api/partners", async (req,res)=>{
  try{
    const b=req.body||{};

    for(const k of ["business","name","phone","email","service"]){
      if(!String(b[k]||"").trim()){
        return res.status(400).json({ok:false,error:`Missing ${k}`});
      }
    }

    // STEP 1: Always capture the application using only the original,
    // guaranteed columns in the contractors table.
    const baseRow={
      business_name:String(b.business).trim(),
      contact_name:String(b.name).trim(),
      phone:String(b.phone).trim(),
      email:String(b.email).trim(),
      service:String(b.service).trim(),
      plan_type:"Founding Partner",
      active:false,
      exclusive:false
    };

    const inserted=await supabase
      .from("contractors")
      .insert(baseRow)
      .select("id,created_at")
      .single();

    if(inserted.error){
      console.error("BASE contractor insert failed:", inserted.error);
      return res.status(500).json({
        ok:false,
        error:`Contractor application was not saved: ${inserted.error.message}`,
        code:inserted.error.code||null
      });
    }

    const contractorId=inserted.data.id;

    // STEP 2: Enrich the captured application with optional founding-partner
    // fields. Failure here does NOT lose the application.
    const optionalFields={
      service_area:String(b.area||"").trim()||null,
      license_number:String(b.license_number||"").trim()||null,
      insured:String(b.insured||"")==="true",
      max_leads_per_week:Number(b.max_leads_per_week||3),
      notes:String(b.notes||"").trim()||null,
      founding_partner:true,
      free_leads_remaining:3
    };

    const enriched=await supabase
      .from("contractors")
      .update(optionalFields)
      .eq("id",contractorId);

    if(enriched.error){
      console.warn(
        "Contractor captured, but optional fields could not be saved:",
        enriched.error.message
      );
    }

    console.log("Contractor application captured:", contractorId);

    return res.json({
      ok:true,
      contractor_id:contractorId,
      created_at:inserted.data.created_at,
      optional_fields_saved:!enriched.error
    });

  }catch(e){
    console.error("Partner endpoint exception:",e);
    return res.status(500).json({
      ok:false,
      error:`Server error while saving contractor: ${e.message}`
    });
  }
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

app.get("/api/admin/contractor-count",admin,async(req,res)=>{
  try{
    const {count,error}=await supabase.from("contractors").select("*",{count:"exact",head:true});
    if(error) throw error;
    res.json({ok:true,count:count||0});
  }catch(e){
    res.status(500).json({ok:false,error:e.message});
  }
});


app.patch("/api/admin/leads/:id",admin,async(req,res)=>{
  try{
    const id=String(req.params.id||"").trim();
    if(!id) return res.status(400).json({ok:false,error:"Missing lead id"});

    const b=req.body||{};
    const allowed=[
      "service","project_type","timeline","zip_code","city","address",
      "details","customer_name","phone","email","lead_value","status"
    ];
    const updates={};

    for(const key of allowed){
      if(Object.prototype.hasOwnProperty.call(b,key)){
        updates[key]=b[key];
      }
    }

    if(!Object.keys(updates).length){
      return res.status(400).json({ok:false,error:"No editable fields supplied"});
    }

    if(Object.prototype.hasOwnProperty.call(updates,"lead_value")){
      updates.lead_value=Number(updates.lead_value||0);
      if(Number.isNaN(updates.lead_value)){
        return res.status(400).json({ok:false,error:"Lead value must be a number"});
      }
    }

    const {data,error}=await supabase
      .from("leads")
      .update(updates)
      .eq("id",id)
      .select("*")
      .single();

    if(error){
      console.error("Lead update failed:",error);
      return res.status(500).json({ok:false,error:error.message});
    }

    await supabase.from("lead_status_history").insert({
      lead_id:id,
      status:String(data.status||"updated"),
      notes:"Lead edited from admin dashboard."
    });

    return res.json({ok:true,lead:data});
  }catch(e){
    console.error("Lead edit endpoint exception:",e);
    return res.status(500).json({ok:false,error:e.message});
  }
});

app.delete("/api/admin/leads/:id",admin,async(req,res)=>{
  try{
    const id=String(req.params.id||"").trim();
    if(!id) return res.status(400).json({ok:false,error:"Missing lead id"});

    const {data,error}=await supabase
      .from("leads")
      .delete()
      .eq("id",id)
      .select("id")
      .single();

    if(error){
      console.error("Lead delete failed:",error);
      return res.status(500).json({ok:false,error:error.message});
    }

    return res.json({ok:true,deleted_id:data.id});
  }catch(e){
    console.error("Lead delete endpoint exception:",e);
    return res.status(500).json({ok:false,error:e.message});
  }
});


app.patch("/api/admin/partners/:id",admin,async(req,res)=>{
  try{
    const id=String(req.params.id||"").trim();
    if(!id) return res.status(400).json({ok:false,error:"Missing contractor id"});

    const b=req.body||{};
    const allowed=[
      "business_name","contact_name","phone","email","service","plan_type",
      "active","exclusive","service_area","license_number","insured",
      "max_leads_per_week","notes","founding_partner","free_leads_remaining"
    ];
    const updates={};

    for(const key of allowed){
      if(Object.prototype.hasOwnProperty.call(b,key)){
        updates[key]=b[key];
      }
    }

    if(Object.prototype.hasOwnProperty.call(updates,"active")){
      updates.active=Boolean(updates.active);
    }
    if(Object.prototype.hasOwnProperty.call(updates,"exclusive")){
      updates.exclusive=Boolean(updates.exclusive);
    }
    if(Object.prototype.hasOwnProperty.call(updates,"insured")){
      updates.insured=Boolean(updates.insured);
    }
    if(Object.prototype.hasOwnProperty.call(updates,"founding_partner")){
      updates.founding_partner=Boolean(updates.founding_partner);
    }
    if(Object.prototype.hasOwnProperty.call(updates,"max_leads_per_week")){
      updates.max_leads_per_week=Number(updates.max_leads_per_week||0);
    }
    if(Object.prototype.hasOwnProperty.call(updates,"free_leads_remaining")){
      updates.free_leads_remaining=Number(updates.free_leads_remaining||0);
    }

    const {data,error}=await supabase
      .from("contractors")
      .update(updates)
      .eq("id",id)
      .select("*")
      .single();

    if(error){
      console.error("Contractor update failed:",error);
      return res.status(500).json({ok:false,error:error.message});
    }

    return res.json({ok:true,contractor:data});
  }catch(e){
    console.error("Contractor edit endpoint exception:",e);
    return res.status(500).json({ok:false,error:e.message});
  }
});

app.post("/api/admin/partners/:id/approve",admin,async(req,res)=>{
  try{
    const id=String(req.params.id||"").trim();
    const {data,error}=await supabase
      .from("contractors")
      .update({active:true})
      .eq("id",id)
      .select("*")
      .single();

    if(error){
      console.error("Contractor approval failed:",error);
      return res.status(500).json({ok:false,error:error.message});
    }

    return res.json({ok:true,contractor:data});
  }catch(e){
    return res.status(500).json({ok:false,error:e.message});
  }
});

app.post("/api/admin/partners/:id/deactivate",admin,async(req,res)=>{
  try{
    const id=String(req.params.id||"").trim();
    const {data,error}=await supabase
      .from("contractors")
      .update({active:false})
      .eq("id",id)
      .select("*")
      .single();

    if(error){
      console.error("Contractor deactivation failed:",error);
      return res.status(500).json({ok:false,error:error.message});
    }

    return res.json({ok:true,contractor:data});
  }catch(e){
    return res.status(500).json({ok:false,error:e.message});
  }
});

app.delete("/api/admin/partners/:id",admin,async(req,res)=>{
  try{
    const id=String(req.params.id||"").trim();
    const {data,error}=await supabase
      .from("contractors")
      .delete()
      .eq("id",id)
      .select("id")
      .single();

    if(error){
      console.error("Contractor delete failed:",error);
      return res.status(500).json({ok:false,error:error.message});
    }

    return res.json({ok:true,deleted_id:data.id});
  }catch(e){
    return res.status(500).json({ok:false,error:e.message});
  }
});

app.get("/api/admin/partners",admin,async(req,res)=>{
  try{
    const {data,error,count}=await supabase
      .from("contractors")
      .select("*",{count:"exact"})
      .order("created_at",{ascending:false})
      .limit(200);

    if(error){
      console.error("Admin contractor read failed:",error);
      return res.status(500).json({ok:false,error:error.message});
    }

    return res.json({
      ok:true,
      count:count||0,
      partners:data||[]
    });
  }catch(e){
    console.error("Admin contractor endpoint exception:",e);
    return res.status(500).json({ok:false,error:e.message});
  }
});

app.listen(process.env.PORT||3000,()=>console.log("WGHS server running"));
