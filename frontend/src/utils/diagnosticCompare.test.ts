import{compareDiagnostics,DiagnosticMetadata}from"./diagnosticCompare";
const B:DiagnosticMetadata={generated_at:"",commit:"a",total_modules:3,passed:2,failed:1,modules:[{name:"auth",status:"passed",artifacts:2},{name:"db",status:"failed",artifacts:1},{name:"api",status:"passed",artifacts:3}]};
const C:DiagnosticMetadata={generated_at:"",commit:"b",total_modules:3,passed:2,failed:1,modules:[{name:"auth",status:"failed",artifacts:2},{name:"db",status:"passed",artifacts:1},{name:"newmod",status:"passed",artifacts:1}]};
describe("compareDiagnostics",()=>{
  const r=compareDiagnostics(B,C);
  it("detects added",()=>{expect(r.added).toHaveLength(1);expect(r.added[0].name).toBe("newmod");});
  it("detects removed",()=>{expect(r.removed).toHaveLength(1);expect(r.removed[0].name).toBe("api");});
  it("detects failed",()=>{expect(r.failed).toHaveLength(1);expect(r.failed[0].name).toBe("auth");});
  it("detects recovered",()=>{expect(r.recovered).toHaveLength(1);expect(r.recovered[0].name).toBe("db");});
  it("summary correct",()=>{expect(r.summary.total_added).toBe(1);expect(r.summary.total_removed).toBe(1);expect(r.summary.total_failed).toBe(1);expect(r.summary.total_recovered).toBe(1);});
  it("sorted deterministically",()=>{
    const r2=compareDiagnostics({...B,modules:[{name:"z",status:"passed",artifacts:1},{name:"a",status:"passed",artifacts:1}]},{...C,modules:[{name:"m",status:"passed",artifacts:1},{name:"b",status:"passed",artifacts:1}]});
    expect(r2.removed[0].name).toBe("a");expect(r2.added[0].name).toBe("b");
  });
});
