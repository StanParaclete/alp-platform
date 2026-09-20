export function resetInput({email,code,password,confirmPassword}) {
  if(!/^[A-Za-z0-9_-]{64}$/.test(code.trim()))throw new Error('Enter the complete recovery code.');
  if(password.length<12||password.length>256)throw new Error('Use a password between 12 and 256 characters.');
  if(password!==confirmPassword)throw new Error('Both passwords must match.');
  return {email:email.trim().toLowerCase(),code:code.trim(),password,confirmPassword};
}
