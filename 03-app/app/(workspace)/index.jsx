import React from 'react';
import {router} from 'expo-router';
import {useSession} from '../../src/session';
import {Page,Label,Copy,Row} from '../../src/ui';
export default function Home(){const {user,school}=useSession();return <Page><Label heading>{school?.school.name||'School access pending'}</Label><Copy>{user.name}</Copy>{school?<><Row title="Students" detail="Plans and progress" onPress={()=>router.push('/students')}/><Row title="Notifications" onPress={()=>router.push('/notifications')}/></>:<Copy>Your account is not linked to a school. Contact your school administrator.</Copy>}<Row title="Settings" detail="School and sign-in" onPress={()=>router.push('/settings')}/></Page>;}
