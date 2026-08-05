const problems = [
  {
    id: 1,
    title: 'Palindrome check',
    statement: "Read a word from standard input. Print 'palindrome' if it reads the same backward as forward, otherwise print 'not palindrome'.",
    language: 'python',
    starterCode: `def strrev(s):
    rev = ""
    for i in range(len(s)):
        rev = rev + s[len(s) - i - 1]
    return rev

def is_palindrome(s):
    rev = strrev(s)
    if s == rev:
        print("palindrome")
    else:
        print("not palindrome")

main_word = input().strip()
is_palindrome(main_word)`,
    testCases: [
      { input: 'madam\n', expectedOutput: 'palindrome\n' },
      { input: 'hello\n', expectedOutput: 'not palindrome\n' },
      { input: 'amma\n', expectedOutput: 'palindrome\n' }
    ]
  }
];

problems.forEach(p => { p.originalCode = p.starterCode; });

module.exports = problems;