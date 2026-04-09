import React from 'react'

export default function About() {
  return (
    <div className="prose max-w-3xl mx-auto p-4">
      <h1>About Metanome</h1>
      <p>
        Data profiling comprises a broad range of methods to efficiently analyze a given data set. In a typical
        scenario, which mirrors the capabilities of commercial data profiling tools, tables of a relational database are
        scanned to derive metadata, such as data types and value patterns, completeness and uniqueness of columns, keys
        and foreign keys, and occasionally functional dependencies and association rules. Individual research projects
        have proposed several additional profiling tasks, such as the discovery of inclusion dependencies or conditional
        functional dependencies.
      </p>
      <p>
        The Metanome project is a joint project between the Hasso-Plattner-Institut (HPI) and the Qatar Computing
        Research Institute (QCRI). Metanome provides a fresh view on data profiling by developing and integrating
        efficient algorithms into a common tool, expanding on the functionality of data profiling, and addressing
        performance and scalability issues for Big Data. A vision of the project appears in SIGMOD Record: "Data
        Profiling Revisited" and demo of the Metanome profiling tool was given at VLDB 2015 "Data Profiling with
        Metanome".
      </p>
      <p>
        The project can be found on GitHub: {" "}
        <a className="text-blue-600 hover:underline" href="https://github.com/HPI-Information-Systems/Metanome" target="_blank" rel="noreferrer">
          https://github.com/HPI-Information-Systems/Metanome
        </a>.
        The Metanome tool is supplied under Apache License. You can use and extend the tool to develop your own profiling
        algorithms. The profiling algorithms contained in our downloadable Metanome build have HPI copyright. You are
        free to use and distribute them for research purposes.
      </p>
      <div className="not-prose mt-2">
        <a
          className="inline-flex items-center gap-2 text-blue-600 hover:underline font-medium"
          href="https://github.com/HPI-Information-Systems/Metanome"
          target="_blank"
          rel="noreferrer"
        >
          <span>View on GitHub</span>
          <span aria-hidden>↗</span>
        </a>
      </div>

      <h2>Metanome Developers</h2>
      <div className="not-prose mt-2 bg-white border rounded-lg shadow-sm p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2">
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Joana Bergsiek</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Maxi Fischer</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Vincent Schwarzer</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Carl Ambroselli</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Tanja Bergmann</span></li>
          </ul>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Claudia Exeler</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Moritz Finke</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Jakob Zwiener</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Sebastian Kruse</span></li>
            <li className="flex items-start gap-2"><span className="mt-2 h-2 w-2 rounded-full bg-blue-600"></span><span>Thorsten Papenbrock</span></li>
          </ul>
        </div>
      </div>
    </div>
  )
}
