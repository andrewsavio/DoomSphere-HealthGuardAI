-- Supabase Schema for Zenova Application

-- 1. Profiles Table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'patient', -- 'patient' or 'doctor'
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Doctor Stats Table
CREATE TABLE public.doctor_stats (
    doctor_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    patients_count INTEGER DEFAULT 0,
    appointments_count INTEGER DEFAULT 0,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.doctor_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctor stats viewable by everyone" ON public.doctor_stats FOR SELECT USING (true);

-- 3. Assignments Table (Doctor-Patient relationship)
CREATE TABLE public.assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    status TEXT DEFAULT 'active'
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Doctors and patients can view their assignments" ON public.assignments 
    FOR SELECT USING (auth.uid() = doctor_id OR auth.uid() = patient_id);

-- 4. Patient Medical Data Table (Snapshot)
CREATE TABLE public.patient_medical_data (
    patient_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    blood_type TEXT,
    height NUMERIC(5, 2), -- cm
    weight NUMERIC(5, 2), -- kg
    allergies TEXT[],
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.patient_medical_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own data" ON public.patient_medical_data FOR SELECT USING (auth.uid() = patient_id);
-- Doctors can also view their assigned patients' data (Requires more complex policy or simple view)
CREATE POLICY "Assigned doctors view patient data" ON public.patient_medical_data 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assignments 
            WHERE assignments.patient_id = patient_medical_data.patient_id 
            AND assignments.doctor_id = auth.uid()
        )
    );
CREATE POLICY "Patients update own data" ON public.patient_medical_data FOR UPDATE USING (auth.uid() = patient_id);
CREATE POLICY "Patients insert own data" ON public.patient_medical_data FOR INSERT WITH CHECK (auth.uid() = patient_id);


-- 5. Medical History Table (Timeline)
CREATE TABLE public.medical_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    condition_name TEXT NOT NULL,
    diagnosed_date DATE,
    status TEXT DEFAULT 'active', -- active, resolved, managing
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.medical_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Patients view own history" ON public.medical_history FOR SELECT USING (auth.uid() = patient_id);
CREATE POLICY "Assigned doctors view history" ON public.medical_history 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.assignments 
            WHERE assignments.patient_id = medical_history.patient_id 
            AND assignments.doctor_id = auth.uid()
        )
    );
CREATE POLICY "Patients update own history" ON public.medical_history FOR UPDATE USING (auth.uid() = patient_id);
CREATE POLICY "Patients insert own history" ON public.medical_history FOR INSERT WITH CHECK (auth.uid() = patient_id);
