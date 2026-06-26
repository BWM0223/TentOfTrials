export interface DiagnosticModule{name:string;status:"passed"|"failed"|"skipped";artifacts:number;artifact_paths?:string[];}
export interface DiagnosticMetadata{generated_at:string;commit:string;total_modules:number;passed:number;failed:number;modules:DiagnosticModule[];}
export interface CompareResult{added:DiagnosticModule[];removed:DiagnosticModule[];changed:Array<{name:string;baseline:DiagnosticModule;candidate:DiagnosticModule}>;failed:Array<{name:string;baseline:DiagnosticModule;candidate:DiagnosticModule}>;recovered:Array<{name:string;baseline:DiagnosticModule;candidate:DiagnosticModule}>;summary:{total_added:number;total_removed:number;total_changed:number;total_failed:number;total_recovered:number};}

export function compareDiagnostics(baseline:DiagnosticMetadata,candidate:DiagnosticMetadata):CompareResult{
  const bm=new Map(baseline.modules.map(m=>[m.name,m]));
  const cm=new Map(candidate.modules.map(m=>[m.name,m]));
  const added:DiagnosticModule[]=[],removed:DiagnosticModule[]=[],changed:CompareResult["changed"]=[],failed:CompareResult["failed"]=[],recovered:CompareResult["recovered"]=[];
  for(const[n,m] of cm) if(!bm.has(n)) added.push(m);
  for(const[n,m] of bm) if(!cm.has(n)) removed.push(m);
  for(const[n,b] of bm){
    const c=cm.get(n); if(!c) continue;
    if(b.status!==c.status||b.artifacts!==c.artifacts){
      const e={name:n,baseline:b,candidate:c};
      if(b.status==="passed"&&c.status==="failed") failed.push(e);
      else if(b.status==="failed"&&c.status==="passed") recovered.push(e);
      else changed.push(e);
    }
  }
  const s=(a:{name:string},b:{name:string})=>a.name.localeCompare(b.name);
  added.sort((a,b)=>a.name.localeCompare(b.name));
  removed.sort((a,b)=>a.name.localeCompare(b.name));
  changed.sort(s); failed.sort(s); recovered.sort(s);
  return{added,removed,changed,failed,recovered,summary:{total_added:added.length,total_removed:removed.length,total_changed:changed.length,total_failed:failed.length,total_recovered:recovered.length}};
}
