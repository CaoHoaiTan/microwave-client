import {createSolver} from './solver.mjs';
const solver=createSolver();
await solver.warmup();
const questions=[
  {q:'She ___ to work every day.',options:['go','goes','going','gone']},
  {q:'Choose the past tense of buy.',options:['buyed','buying','bought','buys']},
  {q:'I have lived here ___ 2020.',options:['for','since','during','at']},
  {q:'Choose the opposite of expensive.',options:['cheap','costly','large','heavy']},
  {q:'If I had more time, I ___ travel more.',options:['will','would','am','have']}
];
const result=await solver.solve(questions,{deadline:Date.now()+60000});
const expected=[1,2,1,0,1];
console.log(`Synthetic English accuracy: ${result.answers.filter((a,i)=>a===expected[i]).length}/5. No game API called.`);
