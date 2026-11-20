-- Repair compatibility with the production schema. Safe to reapply.
CREATE OR REPLACE FUNCTION public.complete_flashcard_session(
  p_user_id uuid, p_deck_id uuid, p_card_ids uuid[], p_correct_answers integer,
  p_start_time timestamptz, p_end_time timestamptz, p_completion_id text,
  p_session_data jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(duplicate boolean, session_id uuid, points_earned integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_deck_name text; v_session_id uuid;
  v_total integer:=COALESCE(array_length(p_card_ids,1),0);
  v_duration integer; v_score integer; v_points integer;
  v_today date:=(p_end_time AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_user_id IS NULL OR p_deck_id IS NULL OR p_start_time IS NULL OR p_end_time IS NULL
    OR p_correct_answers IS NULL OR p_completion_id IS NULL OR p_completion_id='' OR length(p_completion_id)>120 OR v_total=0
    OR p_correct_answers<0 OR p_correct_answers>v_total OR p_end_time<p_start_time THEN
    RAISE EXCEPTION 'invalid flashcard completion' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_completion_id,0));
  SELECT id INTO v_session_id FROM user_study_sessions
    WHERE user_id=p_user_id AND session_type='flashcard' AND metadata->>'completionId'=p_completion_id;
  IF FOUND THEN RETURN QUERY SELECT true,v_session_id,0; RETURN; END IF;
  SELECT name INTO v_deck_name FROM flashcard_decks WHERE id=p_deck_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deck not found' USING ERRCODE='P0002'; END IF;
  IF (SELECT count(DISTINCT id) FROM flashcards WHERE deck_id=p_deck_id AND id=ANY(p_card_ids))<>v_total THEN
    RAISE EXCEPTION 'reviewed cards do not belong to deck' USING ERRCODE='22023';
  END IF;
  v_duration:=round(extract(epoch FROM (p_end_time-p_start_time))/60.0);
  v_score:=round((p_correct_answers::numeric/v_total)*100);
  v_points:=greatest(least(v_total,50),5);
  INSERT INTO user_study_sessions(user_id,session_type,content_id,content_title,start_time,end_time,duration_minutes,score,questions_answered,correct_answers,metadata)
  VALUES(p_user_id,'flashcard',p_deck_id,COALESCE(v_deck_name,'Flashcard Study Session'),p_start_time,p_end_time,v_duration,v_score,v_total,p_correct_answers,
    jsonb_build_object('deckId',p_deck_id,'cardsReviewed',to_jsonb(p_card_ids),'sessionData',COALESCE(p_session_data,'{}'),'averageTime',v_duration::numeric/v_total,'reviewType','session','completionId',p_completion_id))
  RETURNING id INTO v_session_id;
  INSERT INTO user_recent_activities(user_id,activity_type,title,description,icon,points_earned,metadata)
  VALUES(p_user_id,'flashcard_session',COALESCE(v_deck_name,'Flashcard Session'),format('Reviewed %s flashcards',v_total),'albums',v_points,
    jsonb_build_object('deckId',p_deck_id,'score',v_score,'questionsAnswered',v_total,'correctAnswers',p_correct_answers,'duration',v_duration,'sessionId',v_session_id,'completionId',p_completion_id));
  INSERT INTO user_daily_goals(user_id,goal_date,quiz_goal,flashcard_goal,chat_goal,file_goal,study_time_goal,flashcards_reviewed,study_time_minutes)
  VALUES(p_user_id,v_today,1,1,1,0,0,v_total,greatest(v_duration,0))
  ON CONFLICT(user_id,goal_date) DO UPDATE SET
    flashcards_reviewed=COALESCE(user_daily_goals.flashcards_reviewed,0)+v_total,
    study_time_minutes=COALESCE(user_daily_goals.study_time_minutes,0)+greatest(v_duration,0),
    is_completed=(COALESCE(user_daily_goals.quiz_completed,0)>=COALESCE(user_daily_goals.quiz_goal,1) AND COALESCE(user_daily_goals.flashcards_reviewed,0)+v_total>=COALESCE(user_daily_goals.flashcard_goal,1) AND COALESCE(user_daily_goals.chat_sessions,0)>=COALESCE(user_daily_goals.chat_goal,1)),updated_at=now();
  -- Older deployments calculate dashboard stats from activity records and have
  -- no optional daily-stats cache. Keep all essential completion writes atomic.
  IF to_regprocedure('public.update_user_daily_stats(uuid)') IS NOT NULL THEN
    PERFORM public.update_user_daily_stats(p_user_id);
  END IF;
  PERFORM award_xp(p_user_id=>p_user_id,p_amount=>v_points,p_reason=>'Reviewed flashcard deck',p_source_type=>'flashcard',p_source_id=>v_session_id::text,p_metadata=>jsonb_build_object('sessionType','flashcard','score',v_score,'completionId',p_completion_id));
  UPDATE flashcard_decks SET last_reviewed=p_end_time WHERE id=p_deck_id AND user_id=p_user_id;
  RETURN QUERY SELECT false,v_session_id,v_points;
END $$;

REVOKE ALL ON FUNCTION public.complete_flashcard_session(uuid,uuid,uuid[],integer,timestamptz,timestamptz,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_flashcard_session(uuid,uuid,uuid[],integer,timestamptz,timestamptz,text,jsonb) TO service_role;
