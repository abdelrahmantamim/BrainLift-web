-- Migration script to update student_type values to match the app
-- This maps old values to new values

-- First, let's check what values we currently have
SELECT DISTINCT student_type, COUNT(*) as count 
FROM profiles 
GROUP BY student_type;

-- Update the student_type values
UPDATE profiles
SET student_type = CASE
    WHEN student_type = 'university' THEN 'college'
    WHEN student_type = 'graduate' THEN 'college'
    WHEN student_type = 'professional' THEN 'adult'
    WHEN student_type = 'other' THEN 'adult'
    WHEN student_type = 'undergraduate' THEN 'college'
    ELSE student_type -- Keep existing values like high_school, elementary, middle_school
END
WHERE student_type IN ('university', 'graduate', 'professional', 'other', 'undergraduate');

-- Verify the changes
SELECT DISTINCT student_type, COUNT(*) as count 
FROM profiles 
GROUP BY student_type;

-- Update the constraint to only allow the new values
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_student_type_check;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_student_type_check 
CHECK (student_type IN ('elementary', 'middle_school', 'high_school', 'college', 'adult'));