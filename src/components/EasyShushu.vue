<script setup>
import { ref, reactive, computed, watch, shallowRef, onMounted } from "vue";
import { Button, Input, Select, AutoComplete, Alert } from "view-ui-plus";
import { List, ListItem } from "view-ui-plus";
import { Form, FormItem } from "view-ui-plus";
import { Grid, GridItem } from "view-ui-plus";
import { Row, Col } from "view-ui-plus";
import { forEach } from "lodash";
import { generateCodeFrame } from "vue/compiler-sfc";

const srcString = ref(`
{"data":{"headers":["#user_id","#event_name","#event_time","#app_id","#account_id","#distinct_id","#server_time","#kafka_offset","st_rewardcount","userpower","#city","#country","ipv4","report_time","clienttime","st_rewardtype","fixedtime","gameversion","biappname","localetime","clientid","logid","platform","clientreporttime","#country_code","#ip","#province","usercoins","version","userid","type","cgroup","cost","itemid","balance","streaknum","itemfrom","cardnumdesk","buytype","levelid","cardnumbottom","userlanguage","messageid","nid","nopen","ncount","channel","params","clickid","exittype","music","item_list","exitplaytime","exitnewlevel","nbtest","viplv","sound","fb","model","exitiap","noti","systemlanguage","season_id","season_level","exitroundtimes","adid","total_amount","first_login_date","first_login_time","idfv","email","country","current_maximun_level","gaid","idfa","game_version","fb_name","last_login_date","loadcoin","userbuylevel","loadlv","dberr","fromcopy","savelen","freediskspace","ugroupversion","cgroupversion","canplaylevel","firstbuytimes","firstbuytime","osversion","isaeo","countrycode","createtime","loadtime","isnewaeo2","devidemodel","abtests","totaliap","lastlogintime","remotecoin","usetime","error","hasuser","remotelv","ac_piggybank_discount_newlook","ac_piggybank_discount_2","ac_coupon","ac_piggybank_discount_4","ac_piggybank_discount_3","ac_road_to_glory_new","ac_hillside_stroll","ac_find_rudolph","ac_plusfive_discount","ac_chun_new_year","ac_spice_dice","ac_crown_rush","ac_xmas_presents","ac_double_discount_xmas","ac_piggybank_discount_6","ac_piggybank_discount_5","ac_short_pass","ac_piggybank_discount_7","ac_golden_pass_discount","ac_halloween_witch_feast","ac_master_tournament","ac_login_offer","ac_smash_egg","ac_level_rush_spin","ac_buy1_get1","ac_streak_boost","ac_christmas_map","ac_valentine_day","ac_magical_sale","ac_stamp_doublediscount","ac_gemrank","ac_wish_wheel","ac_lucky_tenth","ac_golden_egg","ac_stday_journey","ac_bonus_journey","ac_multi_rank","ac_golden_pass_trial","ac_thanksgiving_feast","ac_rising_deal","ac_lucky_clover","ac_rich","ac_snakes_ladders","ac_july4th","ac_star_tournament","ac_piggybank_discount_xmas","ac_may5gift","ac_xmas_august","ac_july_poly","ac_rose_mania","ac_level_rush","ac_home_renovation","ac_ad_puzzle","ac_double_discount_thanks","ac_buy1free1_momday","ac_journey_of_joy","ac_new_year_sale","ac_perfect_holiday","ac_seek","ac_piggybank_discount_halloween","ac_double_discount","ac_europe_journey","ac_piggybank_discount","ac_black_friday_sale","ac_double_free","ac_level_rush_gift","ac_pinata_bash","ac_reef_rhapsody","ac_weekend_party2","ac_booster_rush","ac_rescue_turkey","ac_matching","ac_mysterious_maze","ac_plant_sale","ac_sunny_picnic","ac_sweetheart_chase","ac_mega_spin","ac_free_stamp","ac_wheel","ac_piggybank_discount_fathersday","ac_eggstra_bonus","ac_treasure_hunt","ac_mother_gift","ac_weekend_party","p_trigger","p_sub_type","msg","dailyold","dailynow","dailysigndays","dailyissigned","dailybegintime","dailydays","dailyfinalget","power","auto","newsubtype","snapdata","ac_turkeyrun_alice","ac_football_mania","ac_bet_level","rvbtn","day","missday","name","sub_add_source","add_source","canexchangestarcount","stampsarray","seed","legendarylv","reallevelid","settingrate","realrate","is_random_level","haspass","expid","clickbtn","costcoincount1","costcoincount2","paytimes2","paytimes1","playgametimes1","playgametimes2","lv2","lv1","challengewincount2","challengewincount1","activity_step","group_id","activity_type","group_order_id","activity_version","smartad","memused","friendnum","nt","fbid","memtotal","friendopen","fbname","willchurn","willpay","will_pay_next_seven_day_ios","willpayios","will_pay_next_seven_day","adtrackstatus","trackertoken","trackername","network","nstring","from_where","curpower","maxpower","lastrecovertime","lefttime","diffpower","recoverinterval","firebaseinstanceid","firebasetoken","chaptorpath","errtype","is_server_control","pig_type","coin","piggy_time_stamp","cb","ecpm","unitid","devicemodel","time","networkname","channelname","score","istreasurehuntlevel","fivebottomnum","levelendtype","itemcost","newstar","bottomnumuse","istreasurelevel","boosters","undonum","levelseedgroup","masterlv","isstarbuff","star","totalcoin","isnewlevel","lv_time","wildnum","iswin","isseeklevel","cur_star","sub_type","box_id","rest_scores","rest_scores_value","task_level","dialogtype","triggerkey","adnetwork","adresultdetail","timeserver","timediff","timelocal","abname","abgroup","abaction","abversion","stepid","servergap","left_time","is_buy","createtimes","ad_adid","ad_channelname","ad_time","ad_adstep","stamp_list","nbid","nbversion","nbgroup","nbaction","crash_upload_date","activity_sort","loc","scores","bonus","spins","point_num","rotation","correction","spincolor","rest_spins_value","rest_spins","creative","campaign","clicklabel","adgroup","mailsubtype","mailid","data","pack_type","price","iapcoin","proid","purchasetoken","productid","orderid","uncollect_reward","func","adunitid","adinterval","adchannel","adresult","israndomlevel","trigger_id","isfirstpurchase","islegendarylevel","sourcefrom","popup_id","trigger_key","popup_shop_id","popup_config_id","p_log","suberrcode","payerrcode","rest_bonusvalue","rest_finalbonus","treasurestarcount","vice_popup_shop_id","honey_total","honey_type","honey_num","ismanual","currentlevel","userlevel","clickedbuy","course_type","isguide","s_reward_is_purchase","s_reward_type","s_reward_level","s_reward_num","s_reward_id","totalpurchase","totalrv","totalinter","curinter","currency","value","currv","live_time","lifetype","level","issold","clicksource","ac_jump_house","point1","point2","quantity","chestid","rank_star","tournament_type","order_group_id","rank_user_id","tournament_id","order_id","getrewardcoin","getrewardtype","resettime","sendtime","logparam","currentpower","popupsource","dialogid","rvtype","rvwhat","lefttimes","rvunitid","rvchannel","canreward","withcorrect","couponid","finalbonus","finalreward","dailylastsystemtime","dailysystemuptime","dailylastsystemelapsedtime","index","ison","rounds","refused_popid","refused_filter_id","otaerrcode","dice_num","dice_total","dice_type","curscores","roadindex","curmap","curdice","roadid","curbonus","tut_num","bufftype","rewardtype","currentpoint","newstarnum","preprogress","curprogress","activity_data2","bonusvalue","is_server_log","popuptimes","dialogsource","mailtab","activity_data3","map_num","road_id","seasonid","optsource","log_type","group","instanceid","flag","stage","count","isbought","curindex","isauto","curtype","tasksource","taskindex","taskid","select_which","oldsaveid","newsaveid","oldlevel","newlevel","binderrcode","isfirstbind","ruby_id","ruby_level","bought_product_id","buyid","bottom_rv_type","isrenew","begintime","expirestime","itemlist","taskprogress","shoptype","isgonow","errcode","bet","lv_num","curnode","curvalue","activity_data1","curstate","curlayer","ac_undefined","choose_popid","dicepoint","loctype","hammer","curhit","skiptype","challengebonus","subbonus","basebonus","building_num","crashlv","life_num","isjumping","checksource","animingtonext","curentryindex","crownlevel","ticket_num","ticket_total","why","ticket_type","memwarn","playedtime","item_option","reward_id","chest_num","lv_sum","mapchest_id","reward_type","reward_num","islocal","stamp_list_array","couponname","buynum","bufftime","ac_joker_buy","percent","act","tab","receipt","servercoin","localcoin","chest_gem","new_type","chest_type","extramsg","stagetype","nextstyle","totalscore","carrotnum","boxid","spinseed","act_type","subloc","ac_toy_hunt","ball_total","ball_num","map_ball_num","mail","id","pair","step","respath","jokercount","ac_merge","ac_splurge","ad_type","precision","adresponseid","currencycode","guideindex","boughtnum","canspin","wheelgroupid","fromwhere","boughtcount","tmpresult2","tmpresult","needshowreward","curround","buy_num","advalue","adplatform","reduce_bottom","ismanifestexist","otapath","controllername","isotaexist","relpath","isotarootexist","findpath","isnewaeo","ac_new_bet","deskcard_merge_totalticket","deskcard_wish_wheel_totalticket","deskcard_wish_wheel_newticket","deskcard_merge_newticket","deskcard_new_bet_newticket","deskcard_new_bet_totalticket","buy_type","rank_num","duck_num","bet_multiple","packindex","stepe","times_in_round","later_action","level_type","candytype","lastshowadnetwork","lastshowadtype","deskcard_treasure_hunt_totalticket","deskcard_treasure_hunt_newticket","deskcard_seek_totalticket","deskcard_seek_newticket","deskcard_jump_house_totalticket","deskcard_jump_house_newticket","buff_time","curcounts","boxtype","curtimes","stampboxid","extrareward","isinlobby","wheel_result","wheel_result2","reward_coin","reward_pack","isbigwin","which","sdkend","streak_times","streak_action","cmdid","cmdargs","cmdtype","cmdret","buffmap","buffid401","buffid412","buffid413","buffid414","buffid441","buffid431","buffid442","buffid421","buffid411","buffid422","ac_treak_or_treat","ac_trick_or_treat","cmdargsvalue","cmdargskey","deskcard_trick_or_treat_totalticket","deskcard_trick_or_treat_newticket","#data_source","where","openbuffs","openbuffnum","crashlvstr","task_sort","reward_sort","firstpurchasetime","order_accept_order","isdone","isgiveup","floor","isghost","money_spent","deskcard_season1_merge_totalticket","deskcard_season1_merge_newticket","rewardkey","dpl_platform","dpl_rk","dphascached","dpl_source","dpl_tp","dpret","dptype","dperr","days","deeperr","dpl_chatid","dpl_pd","dpl_chattype","rvtime2","crashreason","ac_bless_these_foods","firstpurchasetime2","ac_new_christ","isbuff","ac_christ_new","order_finish_order","deskcard_bless_these_foods_newticket","deskcard_bless_these_foods_totalticket","dish_id","can_time","table_id","buy_time","dish_time","can_kind","deskcard_double_discount_xmas_newticket","deskcard_double_discount_xmas_totalticket","70121","ac_nfree","season_type","groupid","seasonstep","item_id","line_id","merge_time","reward","rank","state","ac_finding_santa","coins","deskcard_finding_santa_newticket","deskcard_finding_santa_totalticket","storage","booster","point","rewardindex","curnum","can_id","num","map_id","map_time","node_id","ac_nfree_long","pos","sunnum","carduuid","phase_id","phase","progress","inde","deskcard_season_merge_totalticket","deskcard_season_merge_newticket","merge_exchange","merge_sold","source","showup_times","merge_item_level","merge_item_type","merge_buble_cost","merge_phase","merge_recipe_rewardid","merge_recipe_rewardnum","merge_recipe_maxlevel","merge_recipe_maxtype","isunlock","chest_source","isrecipe","progress_level","ac_double_discount_festival","deskcard_double_discount_festival_newticket","deskcard_double_discount_festival_totalticket","loaderpath","downloadversion","cacheroot","merge_item_phase","item_level","item_type","item_phase","isvalidpigccb","taskstep","task_id","card","subtask_id","quality","task_activity","ac_finding_spring","deskcard_newusermerge_newticket","deskcard_newusermerge_totalticket","ac_patricks_journey","deskcard_newuser_merge_totalticket","deskcard_newuser_merge_newticket","deskcard_finding_spring_totalticket","deskcard_finding_spring_newticket","season_step","jackpot","chapterid","puchasetime","totalcointrue","ac_new_player_gift","surce","map_type","grid_id","item_clean","ac_new_comer_special","ac_newcomer_special","mapindex","newlocation","canjump","entrytype","oldlocation","items","_id","ac_trick_normal","ac_wild_spree","ac_spring_pair","deskcard_spring_pair_newticket","deskcard_spring_pair_totalticket","wild_level","level_id","frist","deskcard_total_num","deskcard_act_type","deskcard_get_num","hint","ac_tournament_pass","ac_tournament_winninggame","ac_tournament_jigsaw","ac_tournament_challenges","ac_tournament_dicegame","ac_tournament_slots","ac_tournament_towers","isfinalstage","ac_spring_spin","deskcard_spring_spin_totalticket","deskcard_spring_spin_newticket","card_num","discount","ac_fast_first","ac_dreamy_nights","ac_decksale","iscontrol","acwant","acdesk","acbottom","control_id","bottom_num","acbooster","acwild","acreal","desk_num","overage_desk","acbonus_wild","acbottom_fix","acbonus_card","acdesk_timing","picture_id","deck_id","deck_have","deck_use","ac_treasure_express","cardx","cardid","ac_piggybank_challenge","ac_piggy_challenge","k_id","match_mark1","match_mark2","match_front","rewardid","item_num","ac_rocket_race","ac_dice_piece","ac_shouldcontrol","ac_endtype","isdouble","ac_endtype2","ac_init_answer","ac_season_master","pig_level","finish_time","ac_merge_short_pass","itemdemands","typeid","ac_bubblesale","ac_boxboost","merge_buble_discount","ac_openchest","can_extra","ac_piggy_run","ac_magicstone_pack","ac_merge_buy1free1","leaderid","teamid","wildwigglecount","can_type","round_id","leagueid","ac_star_deal","ac_lit_spin","ac_sugar_mine","sector_id","shop_id","ac_enchanted_sale","isbackpack","target","ac_merge_build","layer","mine","ac_plus_one_sale","ac_get_more","ac_take_your_pick","email_board","packageid","packageidx","email_fb","dpl_adjust_reftag","panelsize","mergepanelpos","itemorder","diffcount","itemcount","addtype","full_num","gap","genre","item_kind","totaldollar","result","spin_id","box_level","is_vip","pass_type","box3","box1","box2","ac_dream_pass","cooking_id","buy_id","item_list_2","item_list_1","item_list_3","item_list_104","item_list_102","item_list_201","item_list_103","item_list_202","item_list_101","realunitid","callbackname","npc_id","chapter_id","max_level","collect_num","tile","buff","cardtype","build_id","order_type","shopid","#dw_create_time","#dw_update_time","#uuid","newplayer","cardcount","newcardcount","cardsource","stampid","setid","stampstar","joker","bingo_level","box_type","is_cost","consumeditems","diamond_itemid","trycount","wheel_type","ac_endless_deal","ac_candy_party","ac_level_challenge","buff_list","is_rebron","is_win","seasonbegintime","seasonendtime","fbinstallreferrer","guideid","gift_id","gift_type","star_collect_all","cost_type","type_id","times","kind","passscore","ticketdata","fragmentcard","gotfragmentcard","fragmentstreak","gotfragmentstreak","stars","build_cost","build_type","is_hit","is_speedup","open_result","dice_count","new_count","spin_count","paymentspins","diamonds_num","seed_num","water_num","turn","c_userid","c_gameversion","useremoteuser","is_random","pass_level","is_purchased","is_free","totalcount","is_power","networkplacement","adreviewcreativeid","chapter","star_num","merge_buble_cost_type","open_num","is_crown","floor_id","pre_shop_id","shouldshowad","isitemenoughforrv","featureadleftrvcount","configid","leftshowtimes","adusertype","isrewardedvideoready","stage_num","deco_step","unlock_status","power_count","cat_level","remove_num","pass_time","betticket","native","c_version","c_nativeversion","c_packageversion","extrainfo","dspid","dspname","ac_mother_sale","ac_home_decside","ac_mouse_game","ac_sea_race","ac_easter_sale","ac_buy1_get1_tp6","ac_spring_scavenge","ac_double_sale","ac_piggy_sale","ac_gold_miner","ac_collect_card","time_all","time_map","time_merge","time_level","totaliap60day","freervopen","freervbuy","rvvalue14day","zdw_test","mergeid","placement","is_reborn","live_num","is_run","win","cities","socres","list","s_reward_ismerge","target_index","targetindex","nums","ids","tileindex","dicenum","round","rollcount","choice","stepcash","tiles","rewardcount","selectindex","stopatindex","bwin","spindata","idx","centerindex","costcount","rewardnumlist","diceleft","cardleft","lastroundroll","totalroll","completedround","buffleft","buffstarttime","reallv_id","clickindex","dpl_code","dpl_biz","dpl_orderid","dpl_cmd","gems","gem_num","product_price","product_type","pricestr","deeperrstr","pass_level_new","totalwildnum","attempt","streakleftnum","expectclearnum","wildcost","poster","commo_num","layer_num","perfect_num","fail_num","reward_level","reward_jump","lastshowtime","rewards","grid_type","enter_time","bottomcount","roundid","specialplaydata","pop_name","trigger_type","trigger","pool_id","book_id","poster_id","#te_event_id","sub_sub_add_source","sub_add_source_new","is_gem_buy","new","task_ids","cards_treasure_num","cards_treasure_bet","attempts","#lib_version","#os","#zone_offset","#ram","#screen_height","#device_model","#system_language","#network_type","#screen_name","#lib","#device_type","#title","#disk","#carrier","#resume_from_background","#device_id","#bundle_id","#screen_width","#install_time","#simulator","#fps","#manufacturer","#os_version","#app_version","#duration","fps","#background_duration","isv4plus","totaflag","pass_level_list","debug_msg","uiscale","maxlevel","adjust_app_version_raw","timezone","created_at","adjust_os_name","adjust_app_id","adjust_os_version","adjust_app_version_short","adjust_installed_at","ta_account_id","adjust_country","adjust_device_type","adjust_network_name","adjust_sdk_version","adjust_device_name","adjust_impression_based","adjust_is_organic","adjust_region","adjust_adid","adjust_app_version","#data_source_detail","is_reattributed","adjust_ip_address","ta_distinct_id","event_name","adjust_language","adjust_android_id","activity_kind","created_at_milli","publisher_parameters","adjust_platform","adjust_environment","adjust_uninstalled_at","adjust_reinstalled_at","adjust_gps_adid","adjust_revenue","adjust_revenue_usd","currency_code","social_user_id","product_id","udid","transaction_id","adjust_city","adjust_country_subdivision","google_campaign_type","adjust_attribution_match_type","adjust_adgroup_name","adjust_campaign_name","google_adgroup_name","google_ad_type","adjust_conversion_duration","google_adgroup_id","adjust_creative_name","google_network_type","google_campaign_name","google_account_id","google_campaign_id","adjust_time_to_reinstall","guidid","sourcce_str","adjust_idfa","adjust_idfv","uuid","event","uuidtype","adjust_reattributed_at","adjust_click_time","adjust_deeplink","#start_reason","app_version","res_version","c_clientid","user_coin","user_iap_total_usd","user_level","adsourceinstancename","adsourceid","adsourceinstanceid","adsourcename","launch_source","step_type","entry_type","entry_id","avg_try_lv","lv_pass_try","lv_pass_try_100","lv_passrate_14","lv_pass_try_all","lv_duration_daily_14","lv_try_daily_7","lv_pass_try_20","lv_pass_daily_7","lv_passrate_7","lv_duration_daily_30","lv_duration_daily_7","lv_try_daily_30","win_streak_count","lv_try_daily_14","lv_pass_daily_14","lv_passrate_30","lose_streak_count","lv_pass_daily_30","purchase_sum_14d","purchase_sum_30d","purchase_qty_14d","purchase_sum_60d","purchase_qty_7d","purchase_qty_60d","purchase_qty_30d","purchase_sum_7d","active_sum_14d","active_sum_30d","active_sum_7d","coins_earned_free_14d","coins_earned_free_30d","coins_earned_free_7d","booster_count_wild_20lv","booster_count_pre_20lv","booster_count_five_20lv","coins_spent_lv_7d","coins_spent_total_7d","coins_spent_lv_14d","coins_spent_total_14d","coins_spent_total_30d","coins_spent_lv_30d","rv_times_30d","rv_times_14d","rv_times_7d","lv_pass_try_50","booster_count_five_50lv","booster_count_wild_50lv","booster_count_pre_50lv","booster_count_five_7d","booster_count_wild_7d","booster_count_pre_7d","bet_4_pass_20lv","bet_4_pass_50lv","bet_1_pass_20lv","bet_1_pass_50lv","bet_8_pass_50lv","bet_8_pass_20lv","bet_2_pass_50lv","bet_2_pass_20lv","#relaunched_in_background","pay_coins","skyward_quest_level","#app_crashed_reason","#first_check_id","$part_event","$part_date"]},"return_code":0,"return_message":"success","showStackMessage":false}
[1242505651616231424,"ta_app_end","2024-06-19 14:30:03.924","b5b0e6e4bf294193ab5e283df4363c14","sk1Y7TGZB","18c622d046307e96453c5c146b9bb61f312710b9","2024-06-19 14:30:04.380",32741494064,null,null,"中国香港","中国",null,null,null,null,null,null,null,null,null,null,null,null,"HK","103.155.154.42","香港",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"Native_SDK",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"2024-06-19 14:30:05.278",null,"BFD7C1D2-8D56-43E3-8EF3-0713C8AEC938",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"1252993812490366977",null,null,null,null,null,null,null,null,"3.0.1","iOS",8.0,"1.4/5.5",428.0,"iPhone14,3","zh","WIFI","","iOS","iPhone",null,"29.3/119.1","--",null,"19A6CA53-E597-4269-867D-4188E73546AA","com.me2zen.tripeaks",926.0,"2024-06-13 12:23:46.200",false,60.0,"Apple","16.4.1","1.14546.0",3.836,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"ta_app_end","2024-06-19"]
[1242505651616231424,"enter_game","2024-06-19 14:30:03.964","b5b0e6e4bf294193ab5e283df4363c14","sk1Y7TGZB","18c622d046307e96453c5c146b9bb61f312710b9","2024-06-19 14:30:04.716",32741494142,null,5.0,"中国香港","中国",null,null,"2024-06-19T06:30:03.963Z",null,1718778603238,null,null,"Wed Jun 19 14:30:03 2024",null,"5c3e5933-7979-475c-8033-50d463a38b22","ios",null,"HK","103.155.154.42","香港",13700.0,null,null,"enter_game",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,221.0,null,null,null,null,"CN",null,null,null,null,null,0.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"Native_SDK",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"2024-06-19 14:30:05.278",null,"5B925904-0024-4479-8FF2-051A1283D4FD",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"sk1Y7TGZB","14609.0",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,192.0,null,"1.14546.0",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"1252993814046453762",null,null,null,null,null,null,null,null,"3.0.1","iOS",8.0,"1.4/5.5",428.0,"iPhone14,3","zh","WIFI",null,"iOS","iPhone",null,"29.3/119.1","--",null,"19A6CA53-E597-4269-867D-4188E73546AA","com.me2zen.tripeaks",926.0,"2024-06-13 12:23:46.200",false,60.0,"Apple","16.4.1","1.14546.0",null,null,null,null,1.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"1.14546.0","14609.0","18c622d046307e96453c5c146b9bb61f312710b9",13700.0,0.0,221.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,null,null,null,"enter_game","2024-06-19"]
[1242505651616231424,"exit_game","2024-06-19 14:30:03.992","b5b0e6e4bf294193ab5e283df4363c14","sk1Y7TGZB","18c622d046307e96453c5c146b9bb61f312710b9","2024-06-19 14:30:04.716",32741494142,null,5.0,"中国香港","中国",null,null,"2024-06-19T06:30:03.990Z",null,1718778603238,null,null,"Wed Jun 19 14:30:03 2024",null,"65eb7329-3b5a-413d-8e4e-4f7e05ee8a18","ios",null,"HK","103.155.154.42","香港",13700.0,null,null,"exit_game",null,null,null,13700.0,null,null,null,null,-1.0,null,"en",null,null,null,null,null,null,null,0.0,1.0,"{\\\"1\\\":0,\\\"2\\\":0,\\\"3\\\":2,\\\"4\\\":0,\\\"6\\\":0,\\\"7\\\":0,\\\"8\\\":0,\\\"101\\\":3,\\\"102\\\":3,\\\"103\\\":3,\\\"104\\\":3,\\\"201\\\":3,\\\"202\\\":3}",26.0,220.0,null,-1.0,1.0,0.0,null,0.0,1.0,"En",63.0,0.0,0.0,"bb28e4b2dc6185dc4ca9b8d1c9819797",null,null,null,"F03FFAD7-AAFD-4547-A437-4D9FB98DE04E",null,null,null,null,"5D5121FC-9AC9-44F4-B5E2-3438CCBDD188",null,null,null,null,null,null,null,null,null,null,null,null,221.0,null,null,"1641",null,"CN",null,null,null,null,null,0.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,1102.0,null,1.0,null,5626.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"Native_SDK",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"2024-06-19 14:30:05.278",null,"C9BA14DA-E2F0-4356-AA63-69ADC27F6A41",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"sk1Y7TGZB","14609.0",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,192.0,null,"1.14546.0",null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,0.0,0.0,0.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"1252993814046453763",null,null,null,null,null,null,null,null,"3.0.1","iOS",8.0,"1.4/5.5",428.0,"iPhone14,3","zh","WIFI",null,"iOS","iPhone",null,"29.3/119.1","--",null,"19A6CA53-E597-4269-867D-4188E73546AA","com.me2zen.tripeaks",926.0,"2024-06-13 12:23:46.200",false,60.0,"Apple","16.4.1","1.14546.0",null,"<null>",null,null,1.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"1.14546.0","14609.0","18c622d046307e96453c5c146b9bb61f312710b9",13700.0,0.0,221.0,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,0.0,null,null,null,"exit_game","2024-06-19"]
`);

// 经过srcString首次处理后的数据
const allColConfigs = shallowRef({});//所有有值的列
const sameValueColConfigs = shallowRef({}); //这些列有相同的值，不包括所有值都为空的列
const goodColConfigs = shallowRef({});
const allDatas = shallowRef([]); //所有行的数据

const allColNames = computed(() => Object.keys(allColConfigs.value));
const sameValueColNames = computed(() => Object.keys(sameValueColConfigs.value));
const goodColNames = computed(() => Object.keys(goodColConfigs.value));
const fixedColNames = ref(["ttid", "event_time", "clienttime", "event_name"])
const commonTempate1ColNames = ref(fixedColNames.value.concat(["params"]));

const userStData = computed(() => {
  let data = {
    allAccountIds: [],
    allDistinctIds: [],
    allPlatforms: [],
    allCountrys: [],
    allCitys: [],
    jserror_news: [],
    errlogs: [],
  };

  for (let i = 0; i < allDatas.value.length; i++) {
    const row = allDatas.value[i];

    var account_id = row['account_id'];
    if (account_id && data.allAccountIds.indexOf(account_id) < 0) {
      data.allAccountIds.push(account_id);
    }

    var distinct_id = row['distinct_id'];
    if (distinct_id && data.allDistinctIds.indexOf(distinct_id) < 0) {
      data.allDistinctIds.push(distinct_id);
    }

    var platform = row['platform'];
    if (platform && data.allPlatforms.indexOf(platform) < 0) {
      data.allPlatforms.push(platform);
    }

    var country = row['country'];
    if (country && data.allCountrys.indexOf(country) < 0) {
      data.allCountrys.push(country);
    }

    var city = row['city'];
    if (country && data.allCitys.indexOf(city) < 0) {
      data.allCitys.push(city);
    }

    var jserror_new = row.event_name == "jserror_new";
    if (jserror_new) {
      data.jserror_news.push(row.ttid);
    }

    var errlog = row.event_name == "errlog";
    if (errlog) {
      data.errlogs.push(row.ttid);
    }
  }

  return data;
});

watch(srcString, () => {
  parseSrcString();
});

function parseSrcString() {
  allColConfigs.value = {};
  sameValueColConfigs.value = {};
  goodColConfigs.value = {};
  allDatas.value = [];

  var text = srcString.value.trim();
  if (!text) {
    return;
  }

  var t_allColConfigs = {};
  var t_sameValueColConfigs = {};
  var t_goodColConfigs = {};
  var t_allRows = [];

  var rows = text.split(/\r?\n/);
  rows = rows.map((x) => JSON.parse(x));
  if (rows[0].return_code) {
    errorMsg.value = rows[0].return_message;
    return;
  }
  var headers = rows[0].data.headers;

  // 添加一些方便的列
  {
    headers.push("ttid");
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      row.push(r);
    }

    var index = headers.indexOf("clienttime");
    headers.push("event_time_stamp");
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const clienttime = row[index];
      const value = (new Date(clienttime)).getTime();
      row.push(value);
    }
  }

  for (let c = 0; c < headers.length; c++) {
    const head = headers[c];
    var colConfig = getColConfigFromHeader(head);
    if (!colConfig.key) {
      continue;
    }

    var shouldRemoveCol = shouldRemoveColNames.value.indexOf(head) >= 0;
    if (shouldRemoveCol) {
      continue;
    }

    var hasSameValue = true;
    var anyValue = rows.length > 1 ? rows[1][c] : null; //整个这一列是否有值
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const content = row[c];

      if (c == 0) {
        t_allRows[r - 1] = {};
      }

      if (hasSameValue && content != anyValue) {
        hasSameValue = false;
      }

      if (!anyValue) {
        anyValue = content;
      }

      t_allRows[r - 1][colConfig.key] = content;
    }

    if (anyValue) {
      t_allColConfigs[colConfig.key] = colConfig;
      if (hasSameValue) {
        t_sameValueColConfigs[colConfig.key] = colConfig;
        colConfig.value = anyValue;
      }
      else {
        t_goodColConfigs[colConfig.key] = colConfig;
      }
    }
    else {
      for (let r = 1; r < rows.length; r++) {
        const row = t_allRows[r - 1];
        delete row[colConfig.key];
      }
    }

  }

  allColConfigs.value = t_allColConfigs;
  sameValueColConfigs.value = t_sameValueColConfigs;
  goodColConfigs.value = t_goodColConfigs;
  allDatas.value = t_allRows;

  // allDatas.value = allDatas.value.concat(JSON.parse(JSON.stringify(allDatas.value)));
  // allDatas.value = allDatas.value.concat(JSON.parse(JSON.stringify(allDatas.value)));
  // allDatas.value = allDatas.value.concat(JSON.parse(JSON.stringify(allDatas.value)));
  // allDatas.value = allDatas.value.concat(JSON.parse(JSON.stringify(allDatas.value)));
  // allDatas.value = allDatas.value.concat(JSON.parse(JSON.stringify(allDatas.value)));
  // allDatas.value = allDatas.value.concat(JSON.parse(JSON.stringify(allDatas.value)));
  // allDatas.value = allDatas.value.concat(JSON.parse(JSON.stringify(allDatas.value)));
  // for (let i = 0; i < allDatas.value.length; i++) {
  //   const element = allDatas.value[i];
  //   element.ttid = i + 1;

  //   if (Math.random() < 0.2) {
  //     element.event_time = "2024-06-18 14:07:55.693";
  //   }
  //   if (Math.random() < 0.4) {
  //     element.event_time = "2024-06-17 14:07:55.693";
  //   }
  // }

  // window.allDatas = allDatas;
  deepFreeze(allDatas.value);
}

function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(name => {
    let prop = obj[name];
    if (typeof prop === 'object' && prop !== null) {
      deepFreeze(prop);
    }
  });
}

const shouldRemoveColNames = ref(["country", "new", "fps", "event_name", "uuid", "app_version"]);

const defColConfigs = shallowRef({
  "ttid": {
    key: 'ttid',
    title: 'ttid',
    width: 80,
    resizable: true,
    fixed: 'left',
    sortable: true,
  },
  "#event_time": {
    key: 'event_time',
    title: 'event_time(非utc)',
    // slot: 'timestamp',
    width: 250,
    resizable: true,
    fixed: 'left',
    sortable: true,
  },
  "clienttime": {
    key: 'clienttime',
    title: 'clienttime(utc)',
    // slot: 'timestamp',
    width: 250,
    resizable: true,
    fixed: 'left',
    sortable: true,
  },
  "#event_name": {
    key: 'event_name',
    title: 'event_name',
    width: 200,
    resizable: true,
    fixed: 'left',
    sortable: true,
  },
  "params": {
    key: 'params',
    title: 'params',
    width: 250,
    resizable: true,
    sortable: false,
  },
  // "date": {
  //   key: 'date',
  //   title: 'date(utc)',
  //   slot: 'timestamp',
  //   width: 300,
  //   resizable: true,
  // },
});
function getColConfigFromHeader(headerName) {
  var defColConfig = defColConfigs.value[headerName];
  var config = defColConfig;
  if (!config) {
    config = makeDefaultColConfig(headerName);
  }
  return config;
}

function makeDefaultColConfig(headerName) {
  return {
    key: getCodeNameFromHeader(headerName),
    title: headerName,
    width: 300,
    resizable: true,
    sortable: true,
  };
}

function getCodeNameFromHeader(headerName) {
  var codeName = headerName.replaceAll(" ", "");
  codeName = codeName.replaceAll("#", "");
  if (/^[^a-zA-Z]/.test(codeName)) {
    return null;
  }
  return codeName;
}

function arrayRemoveEmpty(arr) {
  var index = arr.findIndex((x) => !x);
  while (index >= 0) {
    arr.splice(index, 1);
    index = arr.findIndex((x) => !x);
  }
}

function getDayFirstTime(timestamp) {
  var date = new Date(timestamp);
  date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}
function localTimeToUTC(date) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000);
}

const searchParam = reactive({
  projectName: "Tripeaks1-Beta",
  times: [getDayFirstTime(Date.now() - 1 * 24 * 60 * 60 * 1000), getDayFirstTime(Date.now())],
  userIdType: "userId",
  userId: "UkR*sIQCD", //sk1Y7TGZB
  maxLimit: 2000,
  isSearching: false,
})

// let thinkingdataUrl = 'http://54.242.216.84:8992/querySql';
let thinkingdataUrl = 'http://10.10.31.17:8992/querysql';
const projectConfigs = {
  "Tripeaks1-Beta": {
    name: "Tripeaks1-Beta",
    tableName: "ta.v_event_17",
    token: "",
  },
  "Tripeaks1": {
    name: "Tripeaks1",
    tableName: "ta.v_event_6",
    token: "",
  },
  "Tripeaks4-Beta": {
    name: "Tripeaks4-Beta",
    tableName: "ta.v_event_16",
    token: "",
  },
  "Tripeaks4": {
    name: "Tripeaks4",
    tableName: "ta.v_event_2",
    token: "",
  },
}
async function onClickSearch() {
  if (searchParam.isSearching) {
    console.log("searching");
    return;
  }
  searchParam.isSearching = true;

  var text = await fetchServer();
  if (!errorMsg.value) {
    if (text.includes("查询似乎出现了一些问题")) {
      errorMsg.value = text;
    }
    // else if (text.includes("return_code")) {

    // }
    else {
      srcString.value = text;
      console.log(text);
    }
  }

  searchParam.isSearching = false;

}

const searchSql = computed(() => {

  const project = projectConfigs[searchParam.projectName];

  const startTime = localTimeToUTC(searchParam.times[0]).toISOString().slice(0, 10)
  var endTime = localTimeToUTC(searchParam.times[1]).toISOString().slice(0, 10)
  var timeCondition = `"$part_date" BETWEEN '${startTime}' AND '${endTime}'`;

  var userCondition = "";
  if (searchParam.userIdType == "userId") {
    userCondition = `"#account_id"='${searchParam.userId}'`
  }
  else if (searchParam.userIdType == "clientId") {
    userCondition = `"#distinct_id"='${searchParam.userId}'`
  }

  var sql = `
  select * from ${project.tableName} where (${timeCondition}) 
  AND (${userCondition}) 
  ORDER BY "#event_time"
  limit ${searchParam.maxLimit}
  `;
  return sql;
});

const taToken = ref(null);
async function fetchToken() {
  var response = await fetch("easy_shushu/config.json");
  var data = await response.json();
  taToken.value = data.token;
};

const errorMsg = ref("");
async function fetchServer() {
  const project = projectConfigs[searchParam.projectName];
  var sql = searchSql.value;

  errorMsg.value = "";

  // const form = {
  //   "token": project.token,
  //   "sql": sql,
  //   format: 'json'
  // };

  let form = new URLSearchParams();
  form.append("token", taToken.value);
  form.append("sql", sql);
  form.append("format", "json");

  try {
    var options = {};
    options.method = 'POST';
    options.headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
    options.body = form;
    console.log(options)

    return fetch(thinkingdataUrl, options).then((response) => {
      return response.text();
    }).catch((reason) => {
      errorMsg.value = reason;
      return "";
    });
  } catch (error) {
    console.log(error);
    return "";
  }

}

const filterParam = ref({
  wantShowColNamesText: "", //想要展示哪些字段
  conditionText: "", //条件过滤表达式
  sortColNames: "event_time", //以哪些列排序
  sortCategory: "升序", //升序降序
  wantShowColNames: computed(() => {
    var extras = filterParam.value.wantShowColNamesText.trim(' ').split(',').filter((x) => x);
    return extras;
  }),
  wantShowColConfigs: computed(() => {
    var ret = filterParam.value.wantShowColNames.map((key) => allColConfigs.value[key]);
    arrayRemoveEmpty(ret);
    return ret;
  }),
});

function onAddColName(value) {
  filterParam.value.wantShowColNamesText += `,${value.label}`;
}

function expandArray(arr1, arr2) {
  arr2.forEach(element => {
    arr1.push(element);
  });
  return arr1;
}


function on_columns_filter(value, option) {
  // return true;
  var arr = value.split(',');
  var last = arr[arr.length - 1];
  last = last.trim();
  if (option == last) {
    return false;
  }
  return last ? option.indexOf(last) >= 0 : true;
}

function on_columns_select(value) {
  var index = filterParam.value.wantShowColNamesText.lastIndexOf(',');
  filterParam.value.wantShowColNamesText = filterParam.value.wantShowColNamesText.slice(0, index + 1) + value;
  console.log('onselect:', value, filterParam.value.wantShowColNamesText);
}


function onClickQuickTemplate(drop, item) {
  var config = drop.children.find((x) => x.name == item);
  config.callback();
}
const quickTemplate = [
  {
    name: "字段模板",
    children: [
      {
        name: "通用模板1",
        callback: function () {
          filterParam.value.wantShowColNamesText = commonTempate1ColNames.value.join(',');
        }
      },
      {
        name: "显示所有字段",
        disabled: true,
        callback: function () {
          filterParam.value.wantShowColNamesText = allColNames.value.join(',');
        }
      },
      {
        name: "只显示值不同的字段",
        callback: function () {
          filterParam.value.wantShowColNamesText = goodColNames.value.join(',');
        }
      },
      {
        name: "只显示值相同的字段",
        callback: function () {
          filterParam.value.wantShowColNamesText = sameValueColNames.value.join(',');
        }
      },
    ]
  },
  {
    name: "快捷查询",
    children: [
      {
        name: "查jserror_new",
        callback: function () {
          filterParam.value.wantShowColNamesText = fixedColNames.value.concat(["msg"]).join(",");
          filterParam.value.conditionText = `x.event_name=="jserror_new"`;
        }
      },
      {
        name: "查errlog",
        callback: function () {
          filterParam.value.wantShowColNamesText = fixedColNames.value.concat(["errtype,msg"]).join(",");
          filterParam.value.conditionText = `x.event_name=="errlog"`;
        }
      },
      {
        name: "查add_items",
        callback: function () {
          filterParam.value.wantShowColNamesText = fixedColNames.value.concat(["add_source", "sub_add_source"]).join(",");
          filterParam.value.conditionText = `x.event_name=="add_items"`;
        }
      },
      {
        name: "查支付购买",
        callback: function () {
          filterParam.value.wantShowColNamesText = fixedColNames.value.concat(["pid", "productid", "pid", "orderid", "add_source", "sub_add_source"]).join(",");
          filterParam.value.conditionText = `["add_items","purchased","payment","ipa_begin","iap_end","iap_restore_begin","iap_verify_begin","subscrib","iap_consume","restore","restore_finish"].indexOf(x.event_name)>=0`;
        }
      },
      {
        name: "调试用的按钮",
        callback: function () {
          window.p = allDatas.value[0].params;
          console.log(JSON.stringify(allDatas.value[0].params));
        }
      },
    ]
  },
]


const filteredAllDatas = computed(() => {
  if (!filterParam.value.conditionText) {
    return allDatas.value;
  }

  var startTime = Date.now();

  var datas = [];
  var hasError = false;
  for (let i = 0; i < allDatas.value.length; i++) {
    const x = allDatas.value[i];

    // let colNames = Object.keys(row).join(',');
    // var code = `const {${colNames}} = row;(${filterParam.value.conditionText})`;

    var code = `!!(${filterParam.value.conditionText})`;

    try {
      const succeed = eval(code);
      if (succeed) {
        datas.push(x);
      }

      // if (i == 0) {
      //   console.log(code);
      //   console.log(succeed);
      // }
    } catch (error) {
      // console.error(code);
      // console.error(error);
      hasError = true;
      break;
    }
  }

  var endTime = Date.now();
  // console.log('diff=', endTime - startTime);

  return datas;
});

const sortedAllDatas = computed(() => {
  var datas = filteredAllDatas.value.concat([]);
  function sort_ab_down(a, b) {
    const va = a[filterParam.value.sortColNames] || "";
    const vb = b[filterParam.value.sortColNames] || "";
    if (va < vb) {
      return 1;
    }
    else if (va === vb) {
      return 0
    }
    else {
      return -1;
    }
  }
  function sort_ab_up(a, b) {
    const va = a[filterParam.value.sortColNames] || "";
    const vb = b[filterParam.value.sortColNames] || "";
    if (va < vb) {
      return -1;
    }
    else if (va === vb) {
      return 0
    }
    else {
      return 1;
    }
  }

  const sort_ab = filterParam.value.sortCategory == "升序" ? sort_ab_up : sort_ab_down;
  datas = datas.sort(sort_ab);
  return datas;
});


const tablePage = ref({
  curPage: 1,
  pageSize: 100,
  pageSizeOpts: [10, 50, 100, 500],
});
function onPageSizeChange(value) {
  tablePage.value.pageSize = value;
}
function onPageChange(value) {
  tablePage.value.curPage = value;
}
const tableDatas = computed(() => {
  var start = (tablePage.value.curPage - 1) * tablePage.value.pageSize;
  var end = start + tablePage.value.pageSize;
  return sortedAllDatas.value.slice(start, end);
});

const tableDescs1 = computed(() => {
  var infos = [];
  infos.push(`本次共查询到${allDatas.value.length}条数据`);

  infos.push(`account_id=${userStData.value.allAccountIds.join(',')}`);
  infos.push(`distinct_id=${userStData.value.allDistinctIds.join(',')}`);
  infos.push(`platform=${userStData.value.allPlatforms.join(',')}`);
  infos.push(`country=${userStData.value.allCountrys.join(',')}`);
  infos.push(`city=${userStData.value.allCitys.join(',')}`);
  if (userStData.value.jserror_news.length > 0) {
    infos.push(`有jserror_new!`);
  }
  if (userStData.value.errlogs.length > 0) {
    infos.push(`有errlog!`);
  }

  return infos;
});

const tableDescs2 = computed(() => {
  var infos = [];
  return infos;
});

onMounted(() => {
  parseSrcString();
  filterParam.value.wantShowColNamesText = commonTempate1ColNames.value.join(',')
  fetchToken();
});


</script>



<template>
  <Row>
    <Col :span="12" name="左半边">
    <Row>
      <Col :span="24">
      <Spin fix :show="searchParam.isSearching">
      </Spin>
      <Row align="middle">
        <Col :span="4" style="text-align: right;">
        <p>选择项目：</p>
        </Col>
        <Col>
        <Select v-model="searchParam.projectName">
          <Option value="Tripeaks1-Beta"></Option>
          <Option value="Tripeaks1"></Option>
          <Option value="Tripeaks4-Beta"></Option>
          <Option value="Tripeaks4"></Option>
        </Select>
        </Col>
      </Row>

      <Row align="middle">
        <Col :span="4" style="text-align: right;">
        <p>玩家时区时间：</p>
        </Col>
        <Col :span="20">
        <DatePicker v-model="searchParam.times" type="daterange" style="width:100%;" />
        </Col>
      </Row>

      <Row align="middle">
        <Col :span="4">
        <Select v-model="searchParam.userIdType">
          <Option value="userId"></Option>
          <Option value="clientId"></Option>
        </Select>
        </Col>
        <Col :span="20">
        <Input v-model="searchParam.userId" :disabled="searchParam.isSearching" clearable search enter-button="Search"
          @on-search="onClickSearch" :filter-method="on_columns_filter" />
        </Col>
      </Row>

      <Row align="middle">
        <Col :span="4" style="text-align: right;">
        <p>条数限制：</p>
        </Col>
        <Col :span="20">
        <Input v-model="searchParam.maxLimit"></Input>
        </Col>
      </Row>

      <Row align="middle">
        <Col :span="4" style="text-align: right;">
        <p>查询SQL：</p>
        </Col>
        <Col :span="20">
        {{ searchSql }}
        </Col>
      </Row>

      </Col>
    </Row>

    <Divider></Divider>

    <Row>
      <Col :span="24">
      <Form :label-width="140">
        <FormItem label="查询模板">
          <Dropdown style="margin-left: 20px" v-for="drop in quickTemplate"
            @on-click="(item) => onClickQuickTemplate(drop, item)">
            <Button type="primary">
              {{ drop.name }}
              <Icon type="ios-arrow-down"></Icon>
            </Button>
            <template #list>
              <DropdownMenu>
                <DropdownItem v-for="item in drop.children" :name="item.name" :disabled="item.disabled">{{ item.name
                  }}
                </DropdownItem>
              </DropdownMenu>
            </template>

          </Dropdown>
        </FormItem>
        <FormItem label="显示哪些字段">
          <div>
            <Input v-model="filterParam.wantShowColNamesText">
            <template #append>
              <Select filterable style="width: 150px;" @on-select="onAddColName">
                <Option v-for="name in allColNames" :value="name">{{
                  name }}</Option>
              </Select>
            </template>
            </Input>
          </div>
        </FormItem>

        <!-- <FormItem label="过滤event_time">
          <DatePicker type="datetimerange" style="width: 100%;" />
        </FormItem> -->
        <FormItem label="条件过滤表达式">
          <Input v-model="filterParam.conditionText" clearable
            placeholder="输入合法的js语句，例如x.event_name=='add_items' && x.clienttime.startsWith('2024')">
          </Input>
        </FormItem>
        <FormItem label="所有数据排序">
          <Select v-model="filterParam.sortColNames" filterable style="width: 50%;">
            <Option value="ttid">ttid</Option>
            <Option value="event_time">event_time</Option>
            <Option value="clienttime">clienttime</Option>
            <Option v-for="name in allColNames" :value="name">{{ name }}</Option>
          </Select>
          <Select v-model="filterParam.sortCategory" style="width: 20%;">
            <Option value="升序">升序</Option>
            <Option value="降序">降序</Option>
          </Select>
        </FormItem>
        <FormItem label="表格分页">
          <Page show-sizer show-total :total="filteredAllDatas.length" :page-size="tablePage.pageSize"
            :page-size-opts="tablePage.pageSizeOpts" @on-change="onPageChange"
            @on-page-size-change="onPageSizeChange" />
        </FormItem>
      </Form>
      </Col>
    </Row>
    </Col>

    <Col :span="1">
    </Col>

    <Col :span="11" name="右半边">
    <Card :bordered="false" dis-hover>
      <template #title>
        查询结果统计
      </template>
      <template v-if="errorMsg">
        {{ errorMsg }}
      </template>
      <template v-if="!errorMsg">
        <ul>
          <li v-for="info in tableDescs1">{{ info }}</li>
        </ul>
        <br>
        <ul>
          <li v-for="info in tableDescs2">{{ info }}</li>
        </ul>
      </template>
    </Card>
    </Col>
  </Row>

  <!-- 表格有序：{{ IsTableSeq }} -->
  <Table :border="true" :columns="filterParam.wantShowColConfigs" :data="tableDatas">
    <template #timestamp="{ row, index }">
      {{ new Date(row.date).toISOString() }}
    </template>
  </Table>


  <!-- <List>
    <ListItem>{{ wantShowColNamesText }}</ListItem>
  </List> -->

</template>


<style>
.vcenter {
  display: flex;
  align-items: center;
}
</style>
