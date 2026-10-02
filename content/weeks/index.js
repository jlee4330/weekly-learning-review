// Per-week question guides. Static JSON imports so both the browser and the server can read openings.
import week01 from "./week-01/questions.json" with { type: "json" };
import week02 from "./week-02/questions.json" with { type: "json" };
import week03 from "./week-03/questions.json" with { type: "json" };
import week04 from "./week-04/questions.json" with { type: "json" };
import week05 from "./week-05/questions.json" with { type: "json" };
import week06 from "./week-06/questions.json" with { type: "json" };
import week07 from "./week-07/questions.json" with { type: "json" };
import week08 from "./week-08/questions.json" with { type: "json" };
import week09 from "./week-09/questions.json" with { type: "json" };
import week10 from "./week-10/questions.json" with { type: "json" };
import week11 from "./week-11/questions.json" with { type: "json" };
import week12 from "./week-12/questions.json" with { type: "json" };
import week13 from "./week-13/questions.json" with { type: "json" };
import week14 from "./week-14/questions.json" with { type: "json" };
import week15 from "./week-15/questions.json" with { type: "json" };
import week16 from "./week-16/questions.json" with { type: "json" };

export const weekQuestions = { 1: week01, 2: week02, 3: week03, 4: week04, 5: week05, 6: week06, 7: week07, 8: week08, 9: week09, 10: week10, 11: week11, 12: week12, 13: week13, 14: week14, 15: week15, 16: week16 };
