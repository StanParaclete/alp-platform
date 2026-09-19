import React,{useState} from 'react';
import {Alert} from 'react-native';
import {router} from 'expo-router';
import {useSession} from '../../src/session';
import {canInvite} from '../../src/invitations.mjs';
import {Page,Label,Copy,Row,Button,ErrorText} from '../../src/ui';
export default function Settings(){const{user,school,setSchool,signOut}=useSession();const[error,setError]=useState('');async function logout(){try{await signOut();}catch{Alert.alert('Signed out on this device','ALP could not revoke the server session. Connect to the internet and ask your administrator to revoke other sessions if this device may be compromised.');}}
  return <Page><Label heading>{user.name}</Label><Copy>{user.email}</Copy><Label>School</Label>{user.memberships.map(item=><Row key={item.school.id} title={item.school.name} detail={`${item.role.replaceAll('_',' ')}${school?.school.id===item.school.id?' | Selected':''}`} onPress={()=>{setSchool(item);router.replace('/');}}/>)}<Button secondary onPress={()=>router.push('/join')}>Join another school</Button>{canInvite(school?.role)?<Button secondary onPress={()=>router.push('/invitations')}>School invitations</Button>:null}<ErrorText>{error}</ErrorText><Button secondary onPress={()=>Alert.alert('Sign out of ALP?','Save any changes before signing out.',[{text:'Cancel',style:'cancel'},{text:'Sign out',style:'destructive',onPress:logout}])}>Sign out</Button></Page>;
}
