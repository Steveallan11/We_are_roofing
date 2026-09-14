import type { QuoteRecord } from "@/lib/types";
import { quoteSentEmail, revisedQuoteEmail, quoteAcceptedEmail, surveyConfirmationEmail, nurtureEmail, variationQuoteSentEmail, invoiceSentEmail, paymentReceivedEmail, projectCompletionEmail } from "./templates";
const quote: QuoteRecord = {id:"preview",job_id:"preview",quote_ref:"WR-Q-PREVIEW",version_number:1,roof_report:"Assessment of the existing roof.",scope_of_works:"Renew roof covering and associated detailing.",cost_breakdown:[],subtotal:199055,vat_amount:39811,total:238866,status:"Approved",missing_info:[],pricing_notes:[],guarantee_text:"As set out in the quotation."};
const base = {customerName:"Steve",jobTitle:"Heather House roof refurbishment",propertyAddress:"66 Example Road, London",businessPhone:"0800 955 8202",businessEmail:"werroofinguk@gmail.com"};
export function emailPreviews() {
  const q = {...base,quote,quoteUrl:"https://example.com/quotation?token=preview"};
  return [
    {name:"New Quote",html:quoteSentEmail(q)},
    {name:"Revised Quote",html:revisedQuoteEmail({...q,changes:["Updated insulation specification","Amended access arrangement"]})},
    {name:"Quote Accepted",html:quoteAcceptedEmail({...base,quoteRef:quote.quote_ref,total:238866,acceptedAt:"2026-09-08"})},
    {name:"Survey Confirmation",html:surveyConfirmationEmail({...base,surveyDate:"15 September 2026",surveyTime:"10:00",surveyorName:"Andy",jobRef:"WR-J-PREVIEW",googleCalLink:"https://example.com/calendar",accessNotes:"Please ensure access to the affected rooms is available."})},
    {name:"Quote Follow-up",html:nurtureEmail(7,{...base,quoteUrl:q.quoteUrl,quoteRef:quote.quote_ref}).html},
    ...[false,true].map(vat=>({name:vat ? "Variation with VAT" : "Variation without VAT",html:variationQuoteSentEmail({...base,quoteRef:"WR-V-PREVIEW",variationUrl:"https://example.com/variation",variations:[{id:"preview",business_id:"preview",job_id:"preview",variation_ref:"WR-V-PREVIEW",title:"Additional leadwork",description:"Renew the agreed lead flashing to the rear abutment.",line_items:[],subtotal:1200,vat_amount:vat ? 240 : 0,total:vat ? 1440 : 1200,approval_required:true,status:"Draft"}]})})),
    {name:"Invoice",html:invoiceSentEmail({...base,invoiceRef:"WR-I-PREVIEW",invoiceUrl:"https://example.com/invoice",dueDate:"22 September 2026",total:12500,invoiceType:"deposit"})},
    {name:"Payment Received",html:paymentReceivedEmail({...base,invoiceRef:"WR-I-PREVIEW",amount:12500,receivedAt:"2026-09-08"})},
    {name:"Project Completion",html:projectCompletionEmail({...base,completedWorks:"The agreed roof covering and detailing have been renewed.",documents:[{label:"Guarantee",url:"https://example.com/guarantee"},{label:"Completion photographs",url:"https://example.com/photos"},{label:"Maintenance information",url:"https://example.com/maintenance"}]})},
    {name:"Missing optional details",html:quoteSentEmail({customerName:"",quote:{...quote,roof_report:"",scope_of_works:"",guarantee_text:null},quoteUrl:q.quoteUrl})},
    {name:"Long names and address",html:quoteSentEmail({...q,customerGreeting:"Mr Alexander Montgomery-Wetherington & Mrs Charlotte Montgomery-Wetherington",jobTitle:"Complete refurbishment of the main building, east wing and adjoining residential accommodation",propertyAddress:"The Estate Office, Heather House and Adjoining Buildings, 66 Example Road, Greater London, United Kingdom"})},
    {name:"Multiple options",html:quoteSentEmail({...q,quote:{...quote,options:[{id:"a",label:"Repair",description:"Repair",recommended:false,cost_breakdown:[],subtotal:995,vat_amount:0,total:995},{id:"b",label:"Replacement",description:"Replacement",recommended:true,cost_breakdown:[],subtotal:3995,vat_amount:0,total:3995}]}})},
    {name:"Large invoice",html:invoiceSentEmail({...base,invoiceRef:"WR-I-PREVIEW",invoiceUrl:"https://example.com/invoice",dueDate:"22 September 2026",total:297060})}
  ];
}
