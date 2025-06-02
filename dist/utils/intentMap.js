"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatIntentToActionsMap = exports.mathGameIntentToActionsMap = exports.petIntentToActionsMap = void 0;
exports.petIntentToActionsMap = {
    sit: "sit",
    wag_tail: "wag_tail",
    walk: "walk_forward",
    come_to_owner: "come_to_owner",
    go_there: "go_there",
    stop: "stop",
    eat: "eat",
    angry: "angry",
    fetch: "fetch",
    follow_owner: "follow_owner",
    comfort_owner: "comfort_owner",
    wander: "wander",
    walk_forward: "walk_forward",
    walk_backward: "walk_backward",
    walk_left: "walk_left",
    walk_right: "walk_right",
    start_math_game: "start_math_game",
    start_chat: "start_chat",
};
exports.mathGameIntentToActionsMap = {
    incorrect_answer: "incorrect_answer",
    correct_answer: "correct_answer",
    math_question: "math_question",
    try_again: "try_again",
    end_math_game: "end_math_game",
};
exports.chatIntentToActionsMap = {
    start_chat: "start_chat",
    end_chat: "end_chat",
};
