import React,{useEffect,useState} from 'react';
import {Alert,Modal,Pressable,Share,Text,View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useSession} from '../../src/session';
import {invitationRoles,canInvite,needsLearners,toggleLearner,invitationStatus,invitationMessage} from '../../src/invitations.mjs';
import {Page,Label,Copy,Field,Button,ErrorText,Busy,Credit,usePalette,useResource} from '../../src/ui';

export default function Invitations(){
  const {api,school}=useSession(),c=usePalette(),allowed=canInvite(school?.role);
  const [email,setEmail]=useState(''),[role,setRole]=useState('TEACHER'),[roleMenu,setRoleMenu]=useState(false),[selected,setSelected]=useState([]);
  const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[studentOffset,setStudentOffset]=useState(0),[offset,setOffset]=useState(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[created,setCreated]=useState(null);
  const invitations=useResource(allowed?`/v1/invitations?offset=${offset}`:null);
  const learners=useResource(allowed&&needsLearners(role)?`/v1/students?q=${encodeURIComponent(search)}&offset=${studentOffset}`:null);
  useEffect(()=>{const timer=setTimeout(()=>{setSearch(query);setStudentOffset(0);},250);return()=>clearTimeout(timer);},[query]);
  async function action(work){setBusy(true);setError('');try{await work();}catch(error){setError(error.message);}finally{setBusy(false);}}
  async function create(){
    const item=await api.request('/v1/invitations',{method:'POST',school:school.school.id,body:{email:email.trim().toLowerCase(),role,studentIds:selected.map(item=>item.id)}});
    setCreated(item);setEmail('');setSelected([]);setOffset(0);invitations.reload();
  }
  function confirmCreate(){Alert.alert('Create invitation?',`${email.trim()} will be invited to ${school.school.name} as ${invitationRoles.find(([id])=>id===role)[1]}.`,[{text:'Cancel',style:'cancel'},{text:'Create invitation',onPress:()=>action(create)}]);}
  function revoke(item){Alert.alert('Revoke invitation?',`The invitation for ${item.email} will stop working.`,[{text:'Cancel',style:'cancel'},{text:'Revoke',style:'destructive',onPress:()=>action(async()=>{await api.request(`/v1/invitations/${item.id}/revoke`,{method:'PATCH',school:school.school.id});invitations.reload();})}]);}
  function closeCode(){Alert.alert('Close this invitation?', 'This code cannot be viewed again. It remains active until accepted, revoked or expired.',[{text:'Keep open',style:'cancel'},{text:'Close',onPress:()=>setCreated(null)}]);}
  if(!allowed)return <Page><Label heading>Invitations</Label><Copy>School administrator access required.</Copy></Page>;
  return <Page><Label heading>School invitations</Label><Copy>{school.school.name}</Copy><ErrorText>{error||invitations.error}</ErrorText>
    <Field label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" maxLength={254} editable={!busy}/>
    <Label>Role</Label><Pressable accessibilityRole="button" accessibilityLabel="Choose invited role" accessibilityState={{expanded:roleMenu,disabled:busy}} disabled={busy} onPress={()=>setRoleMenu(true)} style={{padding:14,borderWidth:1,borderColor:c.line,borderRadius:6,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12}}><Text style={{flex:1,color:c.ink,fontSize:16}}>{invitationRoles.find(([id])=>id===role)[1]}</Text><Ionicons name="chevron-down" size={20} color={c.ink}/></Pressable>
    {needsLearners(role)?<><Label>Linked learners ({selected.length})</Label>{selected.map(item=><Pressable key={item.id} disabled={busy} accessibilityRole="checkbox" accessibilityState={{checked:true}} accessibilityLabel={item.name} onPress={()=>setSelected(values=>values.filter(value=>value.id!==item.id))} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10}}><Ionicons name="checkbox" size={24} color={c.primary}/><View style={{flex:1}}><Label>{item.name}</Label></View></Pressable>)}
      <Field label="Search learners" value={query} onChangeText={setQuery} maxLength={160} editable={!busy}/><ErrorText>{learners.error}</ErrorText>{learners.loading?<Busy/>:null}
      {learners.error?<Button secondary onPress={learners.reload}>Retry learners</Button>:null}
      {learners.data?.items.filter(item=>!selected.some(value=>value.id===item.id)).map(item=><Pressable key={item.id} disabled={busy||selected.length>=50} accessibilityRole="checkbox" accessibilityState={{checked:false,disabled:busy||selected.length>=50}} accessibilityLabel={`${item.name}, grade ${item.grade}`} onPress={()=>setSelected(values=>toggleLearner(values,item,role))} style={{flexDirection:'row',alignItems:'center',gap:10,paddingVertical:12,borderBottomWidth:1,borderColor:c.line}}><Ionicons name="square-outline" size={24} color={c.primary}/><View style={{flex:1}}><Label>{item.name}</Label><Copy>Grade {item.grade}</Copy></View></Pressable>)}
      {learners.data?.total===0?<Copy>No matching learners.</Copy>:null}
      {studentOffset>0?<Button secondary disabled={busy||learners.loading} onPress={()=>setStudentOffset(value=>Math.max(0,value-50))}>Previous learners</Button>:null}{studentOffset+50<(learners.data?.total||0)?<Button secondary disabled={busy||learners.loading} onPress={()=>setStudentOffset(value=>value+50)}>Next learners</Button>:null}
    </>:null}
    <Button disabled={busy||!email.trim()||(needsLearners(role)&&!selected.length)} onPress={confirmCreate}>{busy?'Working...':'Create invitation'}</Button>
    <Label heading>Invitation history</Label>{invitations.loading?<Busy/>:null}{invitations.error?<Button secondary onPress={invitations.reload}>Retry invitations</Button>:null}{invitations.data?.total===0?<Copy>No invitations yet.</Copy>:null}
    {invitations.data?.items.map(item=><View key={item.id} style={{gap:7,paddingVertical:14,borderBottomWidth:1,borderColor:c.line}}><Label>{item.email}</Label><Copy>{invitationRoles.find(([id])=>id===item.role)?.[1]||item.role} | {invitationStatus(item)}</Copy><Copy>Expires {new Date(item.expiresAt).toLocaleString()}</Copy>{invitationStatus(item)==='Pending'?<Button secondary disabled={busy} onPress={()=>revoke(item)}>Revoke invitation</Button>:null}</View>)}
    {offset>0?<Button secondary disabled={busy||invitations.loading} onPress={()=>setOffset(value=>Math.max(0,value-50))}>Previous invitations</Button>:null}{offset+50<(invitations.data?.total||0)?<Button secondary disabled={busy||invitations.loading} onPress={()=>setOffset(value=>value+50)}>Next invitations</Button>:null}
    <Modal visible={roleMenu} onRequestClose={()=>setRoleMenu(false)} animationType="slide"><Page><Label heading>Invited role</Label>{invitationRoles.map(([id,label])=><Pressable key={id} accessibilityRole="radio" accessibilityState={{checked:role===id}} onPress={()=>{setRole(id);setSelected([]);setRoleMenu(false);}} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:15,borderBottomWidth:1,borderColor:c.line}}><Ionicons name={role===id?'radio-button-on':'radio-button-off'} size={24} color={c.primary}/><View style={{flex:1}}><Label>{label}</Label></View></Pressable>)}<Button secondary onPress={()=>setRoleMenu(false)}>Cancel</Button></Page><Credit/></Modal>
    <Modal visible={created!==null} onRequestClose={closeCode} animationType="slide"><Page><Label heading>Invitation created</Label><Copy>{created?.email}</Copy><Copy>Expires {created?new Date(created.expiresAt).toLocaleString():''}</Copy><ErrorText>{error}</ErrorText><Text selectable style={{fontSize:16,lineHeight:26,color:c.ink}}>{created?.token}</Text><Button disabled={busy} onPress={()=>action(()=>Share.share({message:invitationMessage(created,school.school.name)}))}>Share invitation</Button><Button secondary disabled={busy} onPress={closeCode}>Close</Button></Page><Credit/></Modal>
  </Page>;
}
