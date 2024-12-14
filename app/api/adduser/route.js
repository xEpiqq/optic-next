import { NextResponse } from 'next/server';
import { createServerComponentClient } from '../../../utils/supabase/supabaseAdmin';

export async function POST(request) {
  const supabaseAdmin = createServerComponentClient();

  const { email, password = '123456', firstName, lastName, phone, team } = await request.json();

  console.log('Received email:', email);

  try {
    const { data: user, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Error creating user in Supabase Auth:', authError);
      return NextResponse.json({ error: 'Failed to create user in Auth' }, { status: 500 });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: user.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        user_type: "user",
        team: team,
        phone: phone,
      });

    if (profileError) {
      console.error('Error inserting user into profiles table:', profileError);
      return NextResponse.json({ error: 'Failed to add user to profiles table' }, { status: 500 });
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
