import React from 'react';
import {Redirect,Stack} from 'expo-router';
import {useSession} from '../../src/session';
import {usePalette} from '../../src/ui';
export default function Workspace(){const {signedIn,school}=useSession();const c=usePalette();if(!signedIn)return <Redirect href="/login"/>;return <Stack key={school?.school.id||'pending'} screenOptions={{headerStyle:{backgroundColor:c.surface},headerTintColor:c.ink,contentStyle:{backgroundColor:c.bg}}}><Stack.Screen name="index" options={{title:'ALP'}}/><Stack.Screen name="students" options={{title:'Students'}}/><Stack.Screen name="student/[id]" options={{title:'Student'}}/><Stack.Screen name="plan/[id]" options={{title:'ALP builder'}}/><Stack.Screen name="messages/[id]" options={{title:'Messages'}}/><Stack.Screen name="notifications" options={{title:'Notifications'}}/><Stack.Screen name="settings" options={{title:'Settings'}}/></Stack>;}
