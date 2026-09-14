import React,{useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {Alert,Modal,ScrollView,Switch,View} from 'react-native';
import {useLocalSearchParams,useNavigation} from 'expo-router';
import {usePreventRemove} from 'expo-router/react-navigation';
import {useSession} from '../../../src/session';
import {sections,staffRoles,adminRoles} from '../../../src/sections.mjs';
import {createDraft} from '../../../src/draft.mjs';
import {Page,Label,Copy,Field,Button,ErrorText,Busy,Credit,useResource,usePalette} from '../../../src/ui';
export default function Plan(){
  const{id}=useLocalSearchParams(),navigation=useNavigation(),{api,school}=useSession(),c=usePalette();
  const resource=useResource(`/v1/plans/${id}`);
  const controller=useMemo(()=>createDraft(body=>api.request(`/v1/plans/${id}`,{method:'PATCH',school:school.school.id,body})),[api,id,school]);
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const [selected,setSelected]=useState('studentInformation'),[history,setHistory]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [goal,setGoal]=useState({description:'',baseline:'',target:'',unit:'',dueDate:'',direction:'increase'}),[observations,setObservations]=useState({});
  useEffect(()=>{if(resource.data)controller.load(resource.data);},[resource.data,controller]);
  useEffect(()=>{if(!state.dirty||state.saving||state.error)return;const timer=setTimeout(()=>controller.save().catch(()=>{}),1200);return()=>clearTimeout(timer);},[state,controller]);
  usePreventRemove(state.dirty||state.saving,({data})=>{
    if(state.saving){Alert.alert('Saving your changes','Wait for the save to finish before leaving this plan.');return;}
    Alert.alert('Unsaved changes','Stay to save your changes, or discard them and leave.',[{text:'Stay',style:'cancel'},{text:'Discard',style:'destructive',onPress:()=>navigation.dispatch(data.action)}]);
  });
  const plan=state.plan,staff=staffRoles.includes(school?.role),admin=adminRoles.includes(school?.role),editable=staff&&plan&&!['APPROVED','ARCHIVED'].includes(plan.status);
  async function action(work){setBusy(true);setError('');try{await work();}catch(error){setError(error.message);}finally{setBusy(false);}}
  async function addGoal(){
    if(!goal.baseline.trim()||!goal.target.trim()||!Number.isFinite(Number(goal.baseline))||!Number.isFinite(Number(goal.target)))throw new Error('Enter a numeric baseline and target.');
    if(controller.getSnapshot().dirty)await controller.save();
    await api.request(`/v1/plans/${id}/goals`,{method:'POST',school:school.school.id,body:{...goal,baseline:Number(goal.baseline),target:Number(goal.target),revision:controller.getSnapshot().plan.revision}});
    setGoal({description:'',baseline:'',target:'',unit:'',dueDate:'',direction:'increase'});resource.reload();
  }
  async function record(goalId){const value=observations[goalId];if(!value?.trim()||!Number.isFinite(Number(value)))throw new Error('Enter a numeric observation.');await api.request(`/v1/goals/${goalId}/progress`,{method:'POST',school:school.school.id,body:{value:Number(value),observedAt:new Date().toISOString(),note:''}});setObservations(values=>({...values,[goalId]:''}));if(controller.getSnapshot().dirty)await controller.save();resource.reload();}
  function reload(){if(state.saving)return;Alert.alert('Load the latest saved version?','Unsaved changes on this device will be discarded.',[{text:'Cancel',style:'cancel'},{text:'Load latest',style:'destructive',onPress:resource.reload}]);}
  return <Page>{resource.loading?<Busy/>:null}<ErrorText>{resource.error||state.error||error}</ErrorText>{resource.error?<Button secondary onPress={resource.reload}>Retry</Button>:null}{plan&&!resource.loading?<>
    <Label heading>{plan.title}</Label><Copy>{plan.status.replaceAll('_',' ')} | Revision {plan.revision}</Copy><Copy>{sections.filter(([key])=>plan.sections[key]?.trim()).length} of 13 sections complete</Copy>
    {staff?<><Copy>{state.saving?'Saving...':state.dirty?'Unsaved changes':'Saved'}</Copy>{editable?<><Field editable={!busy} label="Plan title" value={plan.title} maxLength={180} onChangeText={title=>controller.change({title})}/><Field editable={!busy} label="Review date (YYYY-MM-DD)" value={plan.reviewDate?.slice(0,10)||''} maxLength={10} onChangeText={reviewDate=>controller.change({reviewDate})}/></>:null}
    <Button secondary disabled={busy||state.saving} onPress={()=>action(async()=>setHistory(await api.request(`/v1/plans/${id}/versions`,{school:school.school.id})))}>Version history</Button></>:null}
    <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{gap:8,paddingVertical:8}}>{sections.map(([key,label],index)=><Button key={key} secondary={selected!==key} onPress={()=>setSelected(key)}>{index+1}. {label}</Button>)}</ScrollView>
    {editable?<Field editable={!busy} label={sections.find(([key])=>key===selected)[1]} value={plan.sections[selected]||''} onChangeText={text=>controller.change({sections:{...plan.sections,[selected]:text}})} multiline maxLength={30000}/>:<><Label>{sections.find(([key])=>key===selected)[1]}</Label><Copy>{plan.sections[selected]||'Not recorded'}</Copy></>}
    {editable?<Button disabled={state.saving||busy||!state.dirty} onPress={()=>action(()=>controller.save())}>Save changes</Button>:null}
    {state.error?<Button secondary disabled={state.saving} onPress={reload}>Load latest version</Button>:null}
    {staff&&plan.status==='DRAFT'?<Button secondary disabled={state.saving||busy} onPress={()=>action(()=>controller.save('IN_REVIEW'))}>Submit for review</Button>:null}
    {admin&&plan.status==='IN_REVIEW'?<><Button disabled={state.saving||busy} onPress={()=>Alert.alert('Approve this ALP?','The current version will become visible to linked families and students.',[{text:'Cancel',style:'cancel'},{text:'Approve',onPress:()=>action(()=>controller.save('APPROVED'))}])}>Approve ALP</Button><Button secondary disabled={busy||state.saving} onPress={()=>action(()=>controller.save('DRAFT'))}>Return to draft</Button></>:null}
    {admin&&['APPROVED','ARCHIVED'].includes(plan.status)?<Button secondary disabled={busy} onPress={()=>action(()=>controller.save('DRAFT'))}>Reopen as draft</Button>:null}
    <Label heading>Goals and progress</Label>{plan.goals?.length===0?<Copy>No goals recorded.</Copy>:null}
    {plan.goals?.map(item=><View key={item.id} style={{borderTopWidth:1,borderColor:c.line,paddingTop:16,gap:8}}><Label>{item.description}</Label><Copy>Baseline: {item.baseline} {item.unit} | Target: {item.target} {item.unit}</Copy><Copy>Due: {item.dueDate.slice(0,10)}</Copy>{item.progress?.map(point=><Copy key={point.id}>{new Date(point.observedAt).toLocaleDateString()}: {point.value} {item.unit}{point.note?` | ${point.note}`:''}</Copy>)}{staff?<><Field label="New observation" keyboardType="numbers-and-punctuation" value={observations[item.id]||''} onChangeText={value=>setObservations(values=>({...values,[item.id]:value}))}/><Button secondary disabled={busy||state.saving} onPress={()=>action(()=>record(item.id))}>Record progress</Button></>:null}</View>)}
    {staff&&plan.status==='DRAFT'?<><Label heading>Add goal</Label>{[['description','Goal'],['baseline','Baseline'],['target','Target'],['unit','Unit'],['dueDate','Due date (YYYY-MM-DD)']].map(([key,label])=><Field key={key} label={label} value={goal[key]} onChangeText={value=>setGoal(previous=>({...previous,[key]:value}))} maxLength={key==='description'?3000:key==='dueDate'?10:60}/>)}<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Label>Decreasing target</Label><Switch accessibilityLabel="Decreasing target" value={goal.direction==='decrease'} onValueChange={value=>setGoal(previous=>({...previous,direction:value?'decrease':'increase'}))}/></View><Button disabled={busy||state.saving} onPress={()=>action(addGoal)}>Add goal</Button></>:null}
    <Modal visible={history!==null} onRequestClose={()=>setHistory(null)} animationType="slide"><Page><Label heading>Version history</Label><Button secondary onPress={()=>setHistory(null)}>Close</Button>{history?.map(version=><View key={version.id} style={{gap:8,paddingVertical:12}}><Label>Revision {version.revision}</Label><Copy>{new Date(version.createdAt).toLocaleString()}</Copy>{sections.map(([key,label])=><React.Fragment key={key}><Label>{label}</Label><Copy>{version.snapshot.sections?.[key]||'Not recorded'}</Copy></React.Fragment>)}</View>)}</Page><Credit/></Modal>
  </>:null}</Page>;
}
