import{r as o,j as e}from"./index-BgJTINQ1.js";function b(){const[t,c]=o.useState({name:"",email:"",company:"",phone:"",message:""}),[a,d]=o.useState({}),[m,l]=o.useState(!1),p=(n,s)=>{let r="";switch(n){case"name":/^[A-Za-z\s]*$/.test(s)||(r="Name should contain only letters and spaces");break;case"email":/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)||(r="Enter a valid email (must contain @ and .)");break;case"phone":/^\d{10}$/.test(s)||(r="Phone number must be 10 digits");break}d(x=>({...x,[n]:r}))},i=n=>{const{name:s,value:r}=n.target;c({...t,[s]:r}),p(s,r)},u=async n=>{if(n.preventDefault(),l(!0),Object.keys(t).forEach(s=>{p(s,t[s])}),Object.values(a).some(s=>s)){alert("Please fix validation errors before submitting"),l(!1);return}try{const s=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(s.ok){const r=await s.json();alert(r.message||"Message sent successfully!"),c({name:"",email:"",company:"",phone:"",message:""}),d({})}else throw new Error("Failed to submit form")}catch(s){alert("Error submitting form"),console.error("Submit error:",s)}finally{l(!1)}};return e.jsxs(e.Fragment,{children:[e.jsx("link",{href:"https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css",rel:"stylesheet"}),e.jsx("link",{href:"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",rel:"stylesheet"}),e.jsx("div",{className:"d-flex align-items-center justify-content-center py-5",children:e.jsx("div",{className:"container",children:e.jsx("div",{className:"row justify-content-center",children:e.jsx("div",{className:"col-lg-6 col-md-8",children:e.jsxs("div",{className:"card shadow-lg border-0",children:[e.jsxs("div",{className:"card-header bg-gradient text-white text-center py-4",style:{background:"linear-gradient(45deg, #6f42c1, #e83e8c)"},children:[e.jsxs("h2",{className:"mb-0",children:[e.jsx("i",{className:"fas fa-envelope me-2"}),"Contact Us"]}),e.jsx("p",{className:"mb-0 mt-2 opacity-75",children:"We'd love to hear from you"})]}),e.jsx("div",{className:"card-body p-4",children:e.jsxs("form",{onSubmit:u,children:[e.jsxs("div",{className:"mb-4",children:[e.jsxs("div",{className:"input-group",children:[e.jsx("span",{className:"input-group-text bg-light border-end-0",children:e.jsx("i",{className:"fas fa-user text-muted"})}),e.jsx("input",{type:"text",name:"name",value:t.name,placeholder:"Your Full Name",className:`form-control border-start-0 ${a.name?"is-invalid":""}`,onChange:i,required:!0})]}),a.name&&e.jsxs("div",{className:"invalid-feedback d-block",children:[e.jsx("i",{className:"fas fa-exclamation-circle me-1"}),a.name]})]}),e.jsxs("div",{className:"mb-4",children:[e.jsxs("div",{className:"input-group",children:[e.jsx("span",{className:"input-group-text bg-light border-end-0",children:e.jsx("i",{className:"fas fa-envelope text-muted"})}),e.jsx("input",{type:"email",name:"email",value:t.email,placeholder:"your.email@example.com",className:`form-control border-start-0 ${a.email?"is-invalid":""}`,onChange:i,required:!0})]}),a.email&&e.jsxs("div",{className:"invalid-feedback d-block",children:[e.jsx("i",{className:"fas fa-exclamation-circle me-1"}),a.email]})]}),e.jsx("div",{className:"mb-4",children:e.jsxs("div",{className:"input-group",children:[e.jsx("span",{className:"input-group-text bg-light border-end-0",children:e.jsx("i",{className:"fas fa-building text-muted"})}),e.jsx("input",{type:"text",name:"company",value:t.company,placeholder:"Company Name (Optional)",className:"form-control border-start-0",onChange:i})]})}),e.jsxs("div",{className:"mb-4",children:[e.jsxs("div",{className:"input-group",children:[e.jsx("span",{className:"input-group-text bg-light border-end-0",children:e.jsx("i",{className:"fas fa-phone text-muted"})}),e.jsx("input",{type:"tel",name:"phone",value:t.phone,placeholder:"1234567890",className:`form-control border-start-0 ${a.phone?"is-invalid":""}`,onChange:i,required:!0})]}),a.phone&&e.jsxs("div",{className:"invalid-feedback d-block",children:[e.jsx("i",{className:"fas fa-exclamation-circle me-1"}),a.phone]})]}),e.jsx("div",{className:"mb-4",children:e.jsxs("div",{className:"input-group",children:[e.jsx("span",{className:"input-group-text bg-light border-end-0 align-items-start pt-3",children:e.jsx("i",{className:"fas fa-message text-muted"})}),e.jsx("textarea",{name:"message",value:t.message,className:"form-control border-start-0",placeholder:"Tell us about your project or inquiry...",rows:4,onChange:i,required:!0})]})}),e.jsx("div",{className:"d-grid",children:e.jsx("button",{type:"submit",disabled:m,className:"btn btn-lg text-white position-relative",style:{background:"linear-gradient(45deg, #6f42c1, #e83e8c)",border:"none",borderRadius:"8px"},children:m?e.jsxs(e.Fragment,{children:[e.jsx("span",{className:"spinner-border spinner-border-sm me-2",role:"status"}),"Sending Message..."]}):e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"fas fa-paper-plane me-2"}),"Send Message"]})})})]})}),e.jsx("div",{className:"card-footer bg-light text-center py-3",children:e.jsxs("small",{className:"text-muted",children:[e.jsx("i",{className:"fas fa-shield-alt me-1"}),"Your information is secure and confidential"]})})]})})})})}),e.jsx("style",{children:`
        .input-group-text {
          width: 45px;
          justify-content: center;
        }
        
        .form-control:focus {
          border-color: #6f42c1;
          box-shadow: 0 0 0 0.2rem rgba(111, 66, 193, 0.25);
        }
        
        .input-group .form-control:focus {
          z-index: 3;
        }
        
        .btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(111, 66, 193, 0.4);
          transition: all 0.3s ease;
        }
        
        .btn:disabled {
          opacity: 0.7;
        }
        
        .card {
          border-radius: 15px;
          overflow: hidden;
        }
        
        .card-header {
          border-bottom: none;
        }
        
        .min-vh-100 {
          min-height: 100vh;
        }
        
        @media (max-width: 768px) {
          .card-body {
            padding: 1.5rem;
          }
          
          .col-lg-6 {
            margin: 0 15px;
          }
        }
      `})]})}export{b as default};
