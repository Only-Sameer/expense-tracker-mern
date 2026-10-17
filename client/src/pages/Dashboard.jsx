import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { useDebounced } from '../hooks.js';
import { CATEGORIES, META, money, today, monthKey, shiftMonth, monthLabel, dayKey, displayCategory, serverCategory, itemId, createDemoExpenses, downloadFile, csvCell, parseCsv, sumAmounts, filterExpenseRecords } from '../lib/finance.js';
import { Sidebar, StatCard, ExpenseForm, ExpenseTable, BudgetCard, SettingsPage } from '../components/BudgetryUI.jsx';
const SpendingChart = lazy(() => import('../components/Charts.jsx').then(module => ({ default: module.SpendingChart })));
const CategoryDonut = lazy(() => import('../components/Charts.jsx').then(module => ({ default: module.CategoryDonut })));

export default function Dashboard({ user, setUser, onThemeToggle, theme }) {
  const [demoMode,setDemoMode]=useState(false);const [expenses,setExpenses]=useState([]);const [loading,setLoading]=useState(Boolean(user));const [loadError,setLoadError]=useState('');
  const [active,setActive]=useState('dashboard');const [selectedMonth,setSelectedMonth]=useState(monthKey(new Date()));const [chartYear,setChartYear]=useState(new Date().getFullYear());
  const [search,setSearch]=useState('');const debouncedSearch=useDebounced(search);const [categoryFilter,setCategoryFilter]=useState('All');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [sort,setSort]=useState('date_desc');const [page,setPage]=useState(1);const pageSize=8;
  const [formOpen,setFormOpen]=useState(false);const [editing,setEditing]=useState(null);const [saving,setSaving]=useState(false);const [formError,setFormError]=useState('');const [toast,setToast]=useState('');const [pending,setPending]=useState(null);const pendingRef=useRef(null);const searchRef=useRef(null);const fileRef=useRef(null);const [swipedId,setSwipedId]=useState('');
  const [budgets,setBudgets]=useState(()=>{try{return JSON.parse(localStorage.getItem('budgetry-budgets')||'{}');}catch{return{};}});
  const [recurring,setRecurring]=useState(()=>{try{return JSON.parse(localStorage.getItem('budgetry-recurring')||'[]');}catch{return[];}});
  const [recurringDraft,setRecurringDraft]=useState({name:'',amount:'',category:'Rent',day:'1'});
  const [customCategories,setCustomCategories]=useState(()=>{try{const items=JSON.parse(localStorage.getItem('budgetry-custom-categories')||'[]');if(!Array.isArray(items))return[];items.forEach(item=>{if(item?.name&&item?.color)META[item.name]={icon:'◆',color:item.color};});return items;}catch{return[];}});
  const [categoryDraft,setCategoryDraft]=useState({name:'',color:'#10B981'});
  // Controls the CSV review dialog. Keeping the state explicit prevents the dashboard render from referencing an undeclared variable.
  const [csvPreview,setCsvPreview]=useState(null);
  const isDemo=demoMode&&!user;const activeUser=user||(isDemo?{name:'Alex Morgan',email:'demo@budgetry.app'}:null);
  const allCategories=useMemo(()=>[...new Set([...CATEGORIES,...customCategories.map(x=>x.name),...expenses.map(x=>displayCategory(x.category)).filter(x=>!CATEGORIES.includes(x))])],[customCategories,expenses]);

  useEffect(()=>{
    if(!user||isDemo){setLoading(false);if(!user&&!isDemo)setExpenses([]);return;}
    let cancelled=false;
    async function loadAll(){setLoading(true);setLoadError('');try{
      // The authenticated recurring endpoint creates due entries once per rule/month.
      const recurringResult=await api('/recurring');
      const first=await api('/expenses?page=1&limit=100&sort=date_desc');let all=first.items||[];const pages=Math.min(Number(first.pages)||1,250);
      for(let start=2;start<=pages;start+=8){const batch=await Promise.all(Array.from({length:Math.min(8,pages-start+1)},(_,i)=>api('/expenses?page='+(start+i)+'&limit=100&sort=date_desc')));all=all.concat(...batch.map(x=>x.items||[]));}
      if(!cancelled){setRecurring(recurringResult.items||[]);setExpenses(all);if(recurringResult.generated>0)setToast('Added '+recurringResult.generated+' due recurring expense'+(recurringResult.generated===1?'':'s')+'.');}
    }catch(e){if(!cancelled)setLoadError(e.message||'Could not load expenses.');}finally{if(!cancelled)setLoading(false);}}
    loadAll();return()=>{cancelled=true;};
  },[user,isDemo]);

  useEffect(()=>{try{localStorage.setItem('budgetry-budgets',JSON.stringify(budgets));localStorage.setItem('budgetry-recurring',JSON.stringify(recurring));localStorage.setItem('budgetry-custom-categories',JSON.stringify(customCategories));}catch{/* Storage is optional. */}customCategories.forEach(item=>{META[item.name]={icon:'◆',color:item.color};});},[budgets,recurring,customCategories]);
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(''),3200);return()=>window.clearTimeout(id);},[toast]);
  useEffect(()=>{setPage(1);},[debouncedSearch,categoryFilter,from,to,sort,selectedMonth]);
  useEffect(()=>{
    function keydown(e){const t=e.target;const typing=t instanceof HTMLElement&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));if(e.key==='Escape'){setFormOpen(false);setEditing(null);return;}if(typing||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key.toLowerCase()==='n'){e.preventDefault();setEditing(null);setFormError('');setFormOpen(true);}if(e.key==='/'){e.preventDefault();setActive('expenses');window.setTimeout(()=>searchRef.current?.focus(),0);}}
    window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);
  },[]);

  const monthItems=useMemo(()=>expenses.filter(x=>monthKey(x.date)===selectedMonth),[expenses,selectedMonth]);
  const previousItems=useMemo(()=>expenses.filter(x=>monthKey(x.date)===shiftMonth(selectedMonth,-1)),[expenses,selectedMonth]);
  const total=useMemo(()=>sumAmounts(monthItems),[monthItems]);
  const previousTotal=useMemo(()=>sumAmounts(previousItems),[previousItems]);
  const change=previousTotal>0?Math.round((total-previousTotal)/previousTotal*100):null;
  const grouped=useMemo(()=>{const m=new Map();monthItems.forEach(x=>{const c=displayCategory(x.category);m.set(c,(m.get(c)||0)+Number(x.amount||0));});return [...m.entries()].sort((a,b)=>b[1]-a[1]);},[monthItems]);
  const topCategory=grouped[0]||null;
  const daysInMonth=new Date(Number(selectedMonth.slice(0,4)),Number(selectedMonth.slice(5,7)),0).getDate();
  const avgDaily=total/(selectedMonth===monthKey(new Date())?new Date().getDate():daysInMonth);
  const donutData=grouped.map(([category,amount])=>({category,amount,color:(META[category]||META.Other).color}));
  const monthlyData=Array.from({length:12},(_,i)=>{const key=chartYear+'-'+String(i+1).padStart(2,'0');return{month:new Date(chartYear,i,1).toLocaleDateString('en-IN',{month:'short'}),amount:expenses.filter(x=>monthKey(x.date)===key).reduce((s,x)=>s+Number(x.amount||0),0)};});
  const filtered=useMemo(()=>filterExpenseRecords(expenses,{query:debouncedSearch,category:categoryFilter,from,to,sort}),[expenses,debouncedSearch,categoryFilter,from,to,sort]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));const currentItems=filtered.slice((page-1)*pageSize,page*pageSize);
  const recurringDetected=useMemo(()=>{const m=new Map();expenses.filter(x=>/(rent|emi|subscription|netflix|spotify|insurance|internet)/i.test(x.note||'')||displayCategory(x.category)==='Rent').forEach(x=>{const k=(x.note||displayCategory(x.category)).toLowerCase().trim();const v=m.get(k)||{name:x.note||displayCategory(x.category),amount:0,count:0};v.amount+=Number(x.amount||0);v.count+=1;m.set(k,v);});return[...m.values()].filter(x=>x.count>=2).slice(0,4);},[expenses]);
  const insight=useMemo(()=>{const old=new Map();previousItems.forEach(x=>{const c=displayCategory(x.category);old.set(c,(old.get(c)||0)+Number(x.amount||0));});for(const [c,v] of grouped){const p=old.get(c)||0;if(p>0&&v>p*1.1)return'You spent '+Math.round((v-p)/p*100)+'% more on '+c+' than last month.';}if(total>0&&previousTotal>0&&total<previousTotal)return'Nice work — your total spending is down '+Math.round((previousTotal-total)/previousTotal*100)+'% from last month.';return'A little awareness each day can make your monthly spending easier to manage.';},[previousItems,grouped,total,previousTotal]);

  function openAdd(){setEditing(null);setFormError('');setFormOpen(true);}
  function resetDemo(){
    if(pendingRef.current){window.clearTimeout(pendingRef.current.timer);pendingRef.current=null;setPending(null);}
    setExpenses(createDemoExpenses());setDemoMode(true);setActive('dashboard');setSelectedMonth(monthKey(new Date()));setChartYear(new Date().getFullYear());
    setSearch('');setCategoryFilter('All');setFrom('');setTo('');setSort('date_desc');setPage(1);
    setToast('Demo data reset — 60 sample expenses loaded locally.');
  }
  function enterDemo(){resetDemo();}
  function exitDemo(){
    if(pendingRef.current){window.clearTimeout(pendingRef.current.timer);pendingRef.current=null;setPending(null);}
    setDemoMode(false);setExpenses([]);setActive('dashboard');setCsvPreview(null);setToast('Demo session ended.');
  }

  function go(view){setActive(view);if(view==='expenses')window.setTimeout(()=>searchRef.current?.focus(),50);}
  async function saveExpense(form){setSaving(true);setFormError('');try{const payload={...form,category:serverCategory(form.category),amount:Number(form.amount),note:form.note.trim()};
    if(isDemo){if(editing)setExpenses(items=>items.map(x=>itemId(x)===itemId(editing)?{...x,...payload,_id:itemId(editing)}:x));else setExpenses(items=>[{...payload,_id:'demo-new-'+Date.now()},...items]);}
    else{const result=editing?await api('/expenses/'+itemId(editing),{method:'PATCH',body:JSON.stringify(payload)}):await api('/expenses',{method:'POST',body:JSON.stringify(payload)});if(editing)setExpenses(items=>items.map(x=>itemId(x)===itemId(editing)?result.item:x));else setExpenses(items=>[result.item,...items]);}
    setFormOpen(false);setEditing(null);setToast(editing?'Expense updated successfully.':'Expense added successfully.');
  }catch(e){setFormError(e.message||'Could not save this expense.');}finally{setSaving(false);}}
  async function finalizeDelete(item){if(!isDemo){try{await api('/expenses/'+itemId(item),{method:'DELETE'});setToast('Expense deleted.');}catch(e){setExpenses(items=>[item,...items]);setToast(e.message||'Delete failed. Expense restored.');}}else setToast('Sample expense removed.');if(pendingRef.current&&itemId(pendingRef.current.item)===itemId(item)){pendingRef.current=null;setPending(null);}}
  function deleteExpense(item){const old=pendingRef.current;if(old){window.clearTimeout(old.timer);finalizeDelete(old.item);}setExpenses(items=>items.filter(x=>itemId(x)!==itemId(item)));const timer=window.setTimeout(()=>finalizeDelete(item),5000);pendingRef.current={item,timer};setPending(item);}
  function undoDelete(){const p=pendingRef.current;if(!p)return;window.clearTimeout(p.timer);setExpenses(items=>[p.item,...items]);pendingRef.current=null;setPending(null);setToast('Delete undone.');}
  async function exportCsv(){try{if(!isDemo){const blob=await api('/expenses/csv');const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='budgetry-expenses.csv';a.click();URL.revokeObjectURL(url);}else{const rows=[['Date','Amount','Category','Note'],...expenses.map(x=>[dayKey(x),x.amount,displayCategory(x.category),x.note||''])];downloadFile('budgetry-expenses.csv',rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');}setToast('CSV export downloaded.');}catch(e){setToast(e.message||'CSV export failed.');}}
  async function exportJson(){try{const data=isDemo?{exportedAt:new Date().toISOString(),expenses}:await api('/auth/export');downloadFile('budgetry-data.json',JSON.stringify(data,null,2),'application/json');setToast('JSON export downloaded.');}catch(e){setToast(e.message||'JSON export failed.');}}
  async function exportAllData(){try{const base=isDemo?{user:activeUser,expenses}:await api('/auth/export');const data={application:'Budgetry',exportedAt:new Date().toISOString(),...base,budgets,recurringExpenses:recurring,customCategories};downloadFile('budgetry-all-data.json',JSON.stringify(data,null,2),'application/json');setToast('Full account export downloaded.');}catch(e){setToast(e.message||'Could not download all your data.');}}

  async function importCsv(file){
    try{
      const rows=parseCsv(await file.text());
      if(rows.length<2)throw new Error('This CSV has no expense rows.');
      const heads=rows[0].map(x=>x.trim().toLowerCase());
      const ix={date:heads.indexOf('date'),amount:heads.indexOf('amount'),category:heads.indexOf('category'),note:heads.indexOf('note')};
      if(ix.date<0||ix.amount<0||ix.category<0)throw new Error('CSV needs Date, Amount, and Category columns.');
      const parsed=rows.slice(1).map((row,i)=>{
        const date=String(row[ix.date]||'').trim().slice(0,10);
        const amount=Number(String(row[ix.amount]||'').replace(/[₹,\s]/g,''));
        const category=displayCategory(String(row[ix.category]||'').trim());
        const dt=new Date(date+'T12:00:00');
        if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(dt.getTime())||dt.toISOString().slice(0,10)!==date)throw new Error('Row '+(i+2)+': use a valid YYYY-MM-DD date.');
        if(!Number.isFinite(amount)||amount<=0)throw new Error('Row '+(i+2)+': amount must be greater than zero.');
        if(!allCategories.includes(category))throw new Error('Row '+(i+2)+': unknown category "'+category+'".');
        return {date,amount,category:serverCategory(category),note:String(row[ix.note]||'').trim().slice(0,300)};
      });
      if(parsed.length>250)throw new Error('Import is limited to 250 rows at a time.');
      const keys=new Set();
      const duplicates=parsed.filter(x=>{const k=[x.date,x.amount,x.category,x.note].join('|');if(keys.has(k))return true;keys.add(k);return false;}).length;
      setCsvPreview({fileName:file.name,items:parsed,duplicates});
    }catch(e){setToast(e.message||'CSV import failed.');}
  }
  async function confirmCsvImport(){
    if(!csvPreview)return;
    const preview=csvPreview;
    try{
      if(isDemo){
        setExpenses(old=>[...preview.items.map((x,i)=>({...x,_id:'demo-import-'+Date.now()+'-'+i,category:displayCategory(x.category)})),...old]);
      }else{
        const response=await api('/expenses/import',{method:'POST',body:JSON.stringify({items:preview.items})});
        setExpenses(old=>[...(response.items||[]),...old]);
      }
      setToast('Imported '+preview.items.length+' expense'+(preview.items.length===1?'':'s')+'.');
      setCsvPreview(null);
    }catch(e){setToast(e.message||'CSV import failed. Some rows may already have been imported; check your list before retrying.');}
  }

  async function deleteAccount(){if(isDemo){exitDemo();return;}try{await api('/auth/account',{method:'DELETE'});setUser(null);setExpenses([]);setToast('Your account was deleted.');}catch(e){setToast(e.message||'Could not delete account.');}}
  function addCustomCategory(event){
    event.preventDefault();
    const name=categoryDraft.name.trim().replace(/\s+/g,' ');
    if(!name||name.length>40||!/^[\p{L}\p{N} '&\/-]+$/u.test(name)){setToast('Use 1–40 letters, numbers, spaces, apostrophes, &, /, or hyphens.');return;}
    if(allCategories.some(item=>item.toLowerCase()===name.toLowerCase())){setToast('That category already exists.');return;}
    const item={name,color:categoryDraft.color};
    META[name]={icon:'◆',color:item.color};
    setCustomCategories(old=>[...old,item]);
    setCategoryDraft({name:'',color:'#10B981'});
    setToast('Custom category added.');
  }
  async function updateCustomCategory(oldName, patch){
    const name=String(patch.name??oldName).trim().replace(/\s+/g,' ');
    const color=patch.color||customCategories.find(item=>item.name===oldName)?.color||'#64748B';
    if(!name||name.length>40||!/^[\p{L}\p{N} '&\/-]+$/u.test(name)){setToast('That category name is not valid.');return;}
    if(name.toLowerCase()!==oldName.toLowerCase()&&allCategories.some(item=>item.toLowerCase()===name.toLowerCase())){setToast('A category with that name already exists.');return;}
    try{
      if(name!==oldName){
        if(isDemo)setExpenses(items=>items.map(item=>displayCategory(item.category)===oldName?{...item,category:name}:item));
        else{
          const result=await api('/expenses/categories/rename',{method:'PATCH',body:JSON.stringify({from:serverCategory(oldName),to:serverCategory(name)})});
          setExpenses(items=>items.map(item=>displayCategory(item.category)===oldName?{...item,category:name}:item));
          if(result.modifiedCount===0)setToast('Category renamed. No existing transactions used the old name.');
        }
      }
      setRecurring(items=>items.map(item=>displayCategory(item.category)===oldName?{...item,category:name}:item));
      delete META[oldName];META[name]={icon:'◆',color};
      setCustomCategories(items=>items.map(item=>item.name===oldName?{name,color}:item));
      setBudgets(items=>{const next={...items};if(oldName!==name&&Object.hasOwn(next,oldName)){if(!Object.hasOwn(next,name))next[name]=next[oldName];delete next[oldName];}return next;});
      setToast(name!==oldName?'Category renamed and matching expenses updated.':'Category colour updated.');
    }catch(error){setToast(error.message||'Could not update the category. No local change was applied.');}
  }
  function removeCustomCategory(name){
    delete META[name];
    setCustomCategories(items=>items.filter(item=>item.name!==name));
    setToast('Category removed from your custom list. Existing expenses are kept.');
  }
  async function addRecurring(e){e.preventDefault();const value=Number(recurringDraft.amount);if(!recurringDraft.name.trim()||!Number.isFinite(value)||value<=0){setToast('Enter a name and a valid amount.');return;}try{if(isDemo){setRecurring(items=>[...items,{id:'demo-r-'+Date.now(),name:recurringDraft.name.trim(),amount:value,category:recurringDraft.category,day:recurringDraft.day,dueDay:Number(recurringDraft.day)}]);setToast('Demo recurring rule saved locally.');}else{const result=await api('/recurring',{method:'POST',body:JSON.stringify({name:recurringDraft.name.trim(),amount:value,category:serverCategory(recurringDraft.category),dueDay:Number(recurringDraft.day)})});setRecurring(items=>[...items,result.item]);if(result.generatedItems?.length)setExpenses(items=>[...result.generatedItems,...items]);setToast(result.generated? 'Recurring rule saved and a due expense was created.':'Recurring expense saved. It will be added automatically when due.');}setRecurringDraft({name:'',amount:'',category:'Rent',day:'1'});}catch(error){setToast(error.message||'Could not save recurring expense.');}}
  async function removeRecurring(item){try{if(isDemo)setRecurring(items=>items.filter(x=>itemId(x)!==itemId(item)));else{await api('/recurring/'+itemId(item),{method:'DELETE'});setRecurring(items=>items.filter(x=>itemId(x)!==itemId(item)));}setToast('Recurring rule removed.');}catch(error){setToast(error.message||'Could not remove recurring rule.');}}

  const addButton=<button type="button" className="button button-primary" onClick={openAdd}>＋ Add expense</button>;
  const editExpense=item=>{setEditing(item);setFormError('');setFormOpen(true);};
  const deleteAndToast=item=>deleteExpense(item);
  const chartAdd=()=>openAdd();
  const pageNumbers=Array.from({length:pageCount},(_,i)=>i+1).filter(n=>n>=Math.max(1,page-2)&&n<=Math.min(pageCount,page+2));

  const main = <div className="dashboard-layout">
    <Sidebar active={active} onChange={go} demo={isDemo} onExit={exitDemo}/>
    <div className="dashboard-main">
      {isDemo&&<div className="demo-banner"><span>✳ You’re exploring 60 sample expenses. This demo stays in this browser and never changes a real account.</span><div><button type="button" onClick={resetDemo}>Reset demo</button><button type="button" onClick={exitDemo}>Exit demo</button></div></div>}
      {active==='dashboard'&&<div className="view-stack">
        <section className="dashboard-page-header"><div><p className="section-kicker">YOUR FINANCIAL SNAPSHOT</p><h1>Good {new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening'}, {activeUser?.name?.split(' ')[0]||'there'} <span className="greeting-spark">✳</span></h1><p className="muted">Know where your money goes.</p></div><div className="header-controls"><label className="month-selector"><span className="sr-only">Select dashboard month</span><input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} aria-label="Select dashboard month"/></label>{addButton}</div></section>
        {loadError&&<div className="error-banner" role="alert"><span>{loadError}</span><button className="button button-secondary" onClick={()=>window.location.reload()}>Retry</button></div>}
        {loading?<div className="stat-grid">{[1,2,3,4].map(i=><div className="stat-card skeleton-card" key={i}><span/><span/><span/></div>)}</div>:<>
          <section className="stat-grid" aria-label="Monthly summary"><StatCard label="Total spent this month" value={money(total)} caption={monthLabel(selectedMonth)} icon="₹" tone="green"/>
            <StatCard label="Change vs last month" value={change===null?'—':Math.abs(change)+'%'} caption={change===null?'Add last month’s data to compare':change>0?'More than last month':change<0?'Less than last month':'Same as last month'} icon={change!==null&&change<=0?'↘':'↗'} tone={change!==null&&change<=0?'green':'red'} trend={change===null?null:{good:change<=0,text:(change>0?'+':'')+change+'%'}}/>
            <StatCard label="Top spending category" value={topCategory?topCategory[0]:'—'} caption={topCategory?money(topCategory[1])+' this month':'Your leading category appears here'} icon={topCategory?(META[topCategory[0]]||META.Other).icon:'◈'} tone="blue"/>
            <StatCard label="Daily average spend" value={money(avgDaily)} caption="Average per calendar day" icon="↗" tone="purple"/>
          </section>
          <Suspense fallback={<section className="charts-grid"><div className="surface-card chart-loading" role="status">Loading spending chart…</div><div className="surface-card chart-loading" role="status">Loading category breakdown…</div></section>}><section className="charts-grid"><SpendingChart data={monthlyData} year={chartYear} onYearChange={setChartYear} onAdd={chartAdd}/><CategoryDonut data={donutData} onAdd={chartAdd}/></section></Suspense>
          <section className="surface-card insight-card"><span className="insight-orb" aria-hidden="true">✳</span><div><p className="section-kicker">A LITTLE INSIGHT</p><p>{insight}</p></div><button type="button" className="text-action" onClick={()=>go('reports')}>View report →</button></section>
          <section className="surface-card recent-expenses-card"><div className="card-heading"><div><p className="section-kicker">LATEST ACTIVITY</p><h2>Recent expenses</h2><p className="muted">Your most recent transactions</p></div><button type="button" className="button button-secondary" onClick={()=>go('expenses')}>View all expenses</button></div>
            <ExpenseTable items={[...expenses].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5)} onEdit={editExpense} onDelete={deleteAndToast} onAdd={openAdd} swipedId={swipedId} onTouchStart={()=>{}} onTouchEnd={()=>{}}/>
          </section>
        </>}
      </div>}
      {active==='expenses'&&<div className="view-stack"><div className="page-title-row"><div className="page-title-block"><p className="section-kicker">TRANSACTION HISTORY</p><h1>Expenses</h1><p className="muted">Search, filter, edit, and organize your expenses.</p></div>{addButton}</div>
        <section className="surface-card expenses-view-card"><div className="expense-toolbar"><div className="search-box"><span aria-hidden="true">⌕</span><label className="sr-only" htmlFor="expense-search">Search expenses by note or category</label><input id="expense-search" ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search notes or categories"/><kbd>/</kbd></div><label className="sort-label">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="date_desc">Newest first</option><option value="date_asc">Oldest first</option><option value="amount_desc">Amount: high to low</option><option value="amount_asc">Amount: low to high</option></select></label></div>
          <div className="filters-row"><label className="filter-select">Category<select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option>All</option>{allCategories.map(c=><option key={c}>{c}</option>)}</select></label><label className="filter-select">From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="filter-select">To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>{(categoryFilter!=='All'||from||to||search)&&<button type="button" className="filter-clear" onClick={()=>{setCategoryFilter('All');setFrom('');setTo('');setSearch('');}}>Clear filters ×</button>}</div>
          <div className="active-filter-chips">{categoryFilter!=='All'&&<button type="button" onClick={()=>setCategoryFilter('All')}>{categoryFilter} ×</button>}{from&&<button type="button" onClick={()=>setFrom('')}>From {from} ×</button>}{to&&<button type="button" onClick={()=>setTo('')}>To {to} ×</button>}</div>
          {loading?<div className="skeleton-table"><div/><div/><div/><div/><div/></div>:<><div className="expense-results-label">{filtered.length.toLocaleString('en-IN')} results <span>· {money(filtered.reduce((s,x)=>s+Number(x.amount||0),0))} filtered total</span></div><ExpenseTable items={currentItems} onEdit={editExpense} onDelete={deleteAndToast} onAdd={openAdd} swipedId={swipedId} onTouchStart={(e,id)=>{e.currentTarget.dataset.touchStart=String(e.touches[0].clientX);}} onTouchEnd={(e,id)=>{const start=Number(e.currentTarget.dataset.touchStart);if(start-e.changedTouches[0].clientX>65)setSwipedId(id);else if(e.changedTouches[0].clientX-start>65)setSwipedId('');}}/></>}
          {filtered.length>0&&<div className="pagination-bar"><span className="muted">Showing {(page-1)*pageSize+1}–{Math.min(page*pageSize,filtered.length)} of {filtered.length}</span><div className="page-buttons"><button type="button" className="button button-secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)} aria-label="Previous page">←</button>{pageNumbers.map(n=><button type="button" key={n} className={'page-number'+(n===page?' current':'')} onClick={()=>setPage(n)} aria-label={'Page '+n} aria-current={n===page?'page':undefined}>{n}</button>)}<button type="button" className="button button-secondary" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)} aria-label="Next page">→</button></div></div>}
        </section><div className="inline-data-actions"><button className="button button-secondary" onClick={exportCsv}>↓ Export CSV</button><button className="button button-secondary" onClick={exportJson}>↓ Export JSON</button><button className="button button-secondary" onClick={()=>fileRef.current?.click()}>↑ Import CSV</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv" onChange={e=>{const file=e.target.files?.[0];if(file)importCsv(file);e.target.value='';}}/></div>
      </div>}
      {active==='reports'&&<div className="view-stack"><div className="page-title-block"><p className="section-kicker">YOUR SPENDING PATTERNS</p><h1>Reports</h1><p className="muted">Understand the story behind your money.</p></div><Suspense fallback={<section className="charts-grid"><div className="surface-card chart-loading" role="status">Loading spending chart…</div><div className="surface-card chart-loading" role="status">Loading category breakdown…</div></section>}><section className="charts-grid"><SpendingChart data={monthlyData} year={chartYear} onYearChange={setChartYear} onAdd={chartAdd}/><CategoryDonut data={donutData} onAdd={chartAdd}/></section></Suspense><section className="surface-card report-summary"><h2>Monthly summary · {monthLabel(selectedMonth)}</h2><div className="report-summary-grid"><div><span>Total spent</span><strong>{money(total)}</strong></div><div><span>Average daily spend</span><strong>{money(avgDaily)}</strong></div><div><span>Transactions</span><strong>{monthItems.length}</strong></div></div><div className="report-insight"><span className="insight-orb">✳</span><p>{insight}</p></div></section></div>}
      {active==='budgets'&&<div className="view-stack"><div className="page-title-block"><p className="section-kicker">PLAN AHEAD</p><h1>Budgets & recurring</h1><p className="muted">Set category limits. See your runway before you overspend.</p></div>
        <section className="surface-card budget-panel"><div className="card-heading"><div><p className="section-kicker">MONTHLY LIMITS</p><h2>Category budgets</h2><p className="muted">{monthLabel(selectedMonth)}</p></div><strong className="budget-month-total">{money(total)} <small>spent</small></strong></div><div className="budget-grid">{allCategories.filter(c=>c!=='Education').map(c=><BudgetCard key={c} category={c} amount={monthItems.filter(x=>displayCategory(x.category)===c).reduce((s,x)=>s+Number(x.amount||0),0)} budget={Number(budgets[c])||0} onChange={(key,value)=>setBudgets(old=>({...old,[key]:value}))}/>)}</div></section>
        <section className="surface-card custom-category-panel">
          <div className="card-heading"><div><p className="section-kicker">PERSONALISE</p><h2>Custom categories</h2><p className="muted">Add labels and colours for how you spend. Category names apply to your saved expenses; colours are remembered in this browser.</p></div></div>
          <form className="category-create-form" onSubmit={addCustomCategory}>
            <div className="field"><label htmlFor="custom-category-name">Category name</label><input id="custom-category-name" value={categoryDraft.name} onChange={event=>setCategoryDraft(old=>({...old,name:event.target.value}))} placeholder="e.g. Pets" maxLength={40} required /></div>
            <div className="field"><label htmlFor="custom-category-color">Badge colour</label><input id="custom-category-color" type="color" value={categoryDraft.color} onChange={event=>setCategoryDraft(old=>({...old,color:event.target.value}))} /></div>
            <button className="button button-primary" type="submit">＋ Add category</button>
          </form>
          <div className="custom-category-list">{customCategories.length?customCategories.map(item=><div className="custom-category-row" key={item.name}>
            <span className="custom-category-swatch" style={{background:item.color}} aria-hidden="true"></span>
            <label className="sr-only" htmlFor={'rename-category-'+item.name}>Rename {item.name}</label>
            <input id={'rename-category-'+item.name} className="custom-category-name-input" key={item.name} defaultValue={item.name} maxLength={40} onBlur={event=>{if(event.currentTarget.value.trim()!==item.name)updateCustomCategory(item.name,{name:event.currentTarget.value,color:item.color});}} />
            <label className="sr-only" htmlFor={'recolor-category-'+item.name}>Colour for {item.name}</label>
            <input id={'recolor-category-'+item.name} className="custom-category-color-input" type="color" value={item.color} onChange={event=>updateCustomCategory(item.name,{name:item.name,color:event.target.value})} />
            <button type="button" className="text-action danger-action" onClick={()=>removeCustomCategory(item.name)} aria-label={'Remove '+item.name+' from custom categories'}>Remove</button>
          </div>):<p className="muted">No custom categories yet. Add one above when you need it.</p>}</div>
        </section>
        <section className="surface-card recurring-panel"><div className="card-heading"><div><p className="section-kicker">REPEATED COMMITMENTS</p><h2>Recurring expenses</h2><p className="muted">Keep rent, subscriptions, and EMIs on your radar.</p></div></div><form className="recurring-form" onSubmit={addRecurring}><div className="field"><label htmlFor="rec-name">Expense name</label><input id="rec-name" value={recurringDraft.name} onChange={e=>setRecurringDraft({...recurringDraft,name:e.target.value})} placeholder="e.g. Music subscription" maxLength={80}/></div><div className="field"><label htmlFor="rec-amount">Monthly amount (₹)</label><input id="rec-amount" type="number" min="1" value={recurringDraft.amount} onChange={e=>setRecurringDraft({...recurringDraft,amount:e.target.value})} placeholder="499"/></div><div className="field"><label htmlFor="rec-cat">Category</label><select id="rec-cat" value={recurringDraft.category} onChange={e=>setRecurringDraft({...recurringDraft,category:e.target.value})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div><div className="field"><label htmlFor="rec-day">Due day</label><select id="rec-day" value={recurringDraft.day} onChange={e=>setRecurringDraft({...recurringDraft,day:e.target.value})}>{Array.from({length:28},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}</option>)}</select></div><button className="button button-primary" type="submit">＋ Add recurring</button></form>
          <div className="recurring-list">{recurring.map(x=><div className="recurring-row" key={itemId(x)}><span className="expense-leading">{(META[displayCategory(x.category)]||META.Other).icon}</span><div><strong>{x.name}</strong><span className="muted">{displayCategory(x.category)} · Due day {x.dueDay??x.day}</span></div><strong>{money(x.amount)}<small>/mo</small></strong><button type="button" className="icon-button danger-action" onClick={()=>removeRecurring(x)} aria-label={'Remove recurring expense '+x.name}>×</button></div>)}
          {recurringDetected.length>0&&<div className="recurring-detected"><p className="section-kicker">DETECTED IN YOUR HISTORY</p>{recurringDetected.map(x=><div className="recurring-row" key={x.name}><span className="expense-leading">↻</span><div><strong>{x.name}</strong><span className="muted">Seen {x.count} times</span></div><strong>{money(x.amount/x.count)}<small>/entry</small></strong></div>)}</div>}
          {!recurring.length&&!recurringDetected.length&&<p className="muted recurring-empty">No recurring expenses added yet. Start with rent, subscriptions, or EMIs.</p>}</div>
        </section></div>}
      {active==='settings'&&<SettingsPage user={activeUser} demo={isDemo} onDelete={deleteAccount} onImport={importCsv} onCsv={exportCsv} onJson={exportJson} onAllData={exportAllData} onThemeToggle={onThemeToggle} theme={theme}/>}
    </div>
    <nav className="mobile-bottom-nav" aria-label="Bottom navigation">{[['dashboard','▦','Home'],['expenses','≡','Expenses'],['reports','▥','Reports'],['budgets','◴','Budgets'],['settings','⚙','Settings']].map(([id,icon,label])=><button key={id} type="button" className={active===id?'active':''} onClick={()=>go(id)} aria-current={active===id?'page':undefined}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}</nav>
    <button type="button" className="mobile-fab" aria-label="Add expense" onClick={openAdd}>＋</button>
    {formOpen&&<ExpenseForm key={editing?itemId(editing):'new'} categories={allCategories} initialValue={editing} onClose={()=>{setFormOpen(false);setEditing(null);setFormError('');}} onSubmit={saveExpense} submitting={saving} error={formError} clearError={setFormError}/>}
    {csvPreview&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setCsvPreview(null);}}><section className="confirm-modal csv-preview-modal" role="dialog" aria-modal="true" aria-labelledby="csv-preview-title"><div className="modal-head"><div><p className="section-kicker">IMPORT REVIEW</p><h2 id="csv-preview-title">Preview CSV import</h2><p className="muted">{csvPreview.fileName} · {csvPreview.items.length} valid rows</p></div><button type="button" className="icon-button" onClick={()=>setCsvPreview(null)} aria-label="Cancel CSV import">×</button></div><p>Review a sample before saving. Nothing is imported until you confirm.</p>{csvPreview.duplicates>0&&<p className="csv-warning" role="note">{csvPreview.duplicates} duplicate row(s) found inside this file; review them before importing.</p>}<div className="csv-preview-table"><table><thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="numeric">Amount</th></tr></thead><tbody>{csvPreview.items.slice(0,8).map((x,i)=><tr key={i}><td>{x.date}</td><td>{displayCategory(x.category)}</td><td>{x.note||'—'}</td><td className="numeric">{money(x.amount)}</td></tr>)}</tbody></table></div>{csvPreview.items.length>8&&<p className="muted">Showing the first 8 of {csvPreview.items.length} rows. All rows were validated.</p>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={()=>setCsvPreview(null)}>Cancel</button><button type="button" className="button button-primary" onClick={confirmCsvImport}>Import {csvPreview.items.length} expenses</button></div></section></div>}
    {toast&&<div className="toast-message" role="status"><span>{toast}</span><button type="button" aria-label="Dismiss notification" onClick={()=>setToast('')}>×</button></div>}
    {pending&&<div className="undo-snackbar" role="status"><span>Expense hidden temporarily.</span><button type="button" onClick={undoDelete}>Undo</button></div>}
    {loading&&<div className="sr-only" role="status">Loading expenses…</div>}
  </div>;

  if(!activeUser)return <section className="public-home"><div className="public-home-copy"><span className="eyebrow">PERSONAL FINANCE, MADE CLEAR</span><h1>Know where your money <span>goes.</span></h1><p>One calm place to track everyday spending, understand monthly patterns, and build better habits with your money.</p><div className="hero-actions"><a href="/signup" className="button button-primary">Create free account ↗</a><a href="/login" className="button button-secondary">Sign in</a><button type="button" className="button button-quiet" onClick={enterDemo}>Try demo data</button></div><div className="public-trust-row"><span>✓ Private expense records</span><span>✓ Monthly charts</span><span>✓ Export when you need it</span></div></div>
    <div className="public-home-preview"><div className="preview-float preview-float-one">↗ <span><small>Track everyday spending</small><strong>₹1,24,580</strong></span></div><div className="public-mini-card"><div className="public-mini-top"><span className="preview-dot"/>BUDGETRY OVERVIEW</div><div className="public-mini-total">₹24,560<span>this month</span></div><div className="public-mini-chart">{[35,60,44,77,52,90,61].map((h,i)=><span key={i} style={{height:h+'%'}}/>)}</div><div className="public-mini-note"><span className="preview-dot"/>Know where your money goes.</div></div><div className="preview-float preview-float-two">✳ <span><small>More clarity</small><strong>One day at a time</strong></span></div></div>
    <div className="public-home-features"><article><span>01 / TRACK</span><h2>Keep the details tidy</h2><p>Add, search, sort, and categorize every expense in seconds.</p></article><article><span>02 / UNDERSTAND</span><h2>See the bigger picture</h2><p>Monthly charts and category breakdowns make patterns visible.</p></article><article><span>03 / STAY READY</span><h2>Make a plan that fits</h2><p>Set category budgets, organize recurring costs, and export your data.</p></article></div>
    <section className="public-screenshot" aria-labelledby="dashboard-preview-title"><div className="public-screenshot-heading"><span className="eyebrow">A LOOK INSIDE BUDGETRY</span><h2 id="dashboard-preview-title">Your whole month, at a glance.</h2><p>Monthly totals, spending trends, category breakdowns, and recent expenses in one calm workspace.</p></div><img src="/dashboard-preview.svg" alt="Illustrative screenshot of Budgetry’s dashboard, showing monthly spending summary cards, a bar chart, a category donut chart, and recent expenses. All values are sample data." width="1200" height="720" loading="lazy" /></section></section>;
  return <>{main}</>;
}
