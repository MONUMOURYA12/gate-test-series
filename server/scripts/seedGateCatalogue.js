const mongoose = require("mongoose");
require("dotenv").config();

const Branch = require("../models/Branch");
const Subject = require("../models/Subject");

const branchDefinitions = [
  ["AE", "Aerospace Engineering", ["Engineering Mathematics", "Aerodynamics", "Flight Mechanics", "Propulsion", "Aerospace Structures"]],
  ["AG", "Agricultural Engineering", ["Engineering Mathematics", "Farm Machinery", "Soil and Water Resources", "Agricultural Processing", "Irrigation and Drainage"]],
  ["AR", "Architecture and Planning", ["Engineering Mathematics", "Architecture and Design", "Building Materials and Construction", "Building Services", "Planning and Housing"]],
  ["BM", "Biomedical Engineering", ["Engineering Mathematics", "Biomedical Signals and Systems", "Medical Imaging", "Biomaterials", "Anatomy and Physiology"]],
  ["BT", "Biotechnology", ["Engineering Mathematics", "Biochemistry", "Cell Biology", "Genetics and Evolution", "Molecular Biology", "Bioprocess Engineering"]],
  ["CE", "Civil Engineering", ["Engineering Mathematics", "Structural Engineering", "Geotechnical Engineering", "Water Resources", "Environmental Engineering", "Transportation Engineering", "Geomatics"]],
  ["CH", "Chemical Engineering", ["Engineering Mathematics", "Process Calculations", "Thermodynamics", "Fluid Mechanics", "Heat and Mass Transfer", "Chemical Reaction Engineering", "Process Control"]],
  ["CS", "Computer Science and Information Technology", ["Engineering Mathematics", "Digital Logic", "Computer Organization", "Programming and Data Structures", "Algorithms", "Theory of Computation", "Compiler Design", "Operating Systems", "Databases", "Computer Networks"]],
  ["CY", "Chemistry", ["Physical Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Spectroscopy", "Thermodynamics", "Chemical Kinetics"]],
  ["DA", "Data Science and Artificial Intelligence", ["Probability and Statistics", "Linear Algebra", "Programming and Data Structures", "Algorithms", "Database Management", "Machine Learning", "Artificial Intelligence"]],
  ["EC", "Electronics and Communication Engineering", ["Engineering Mathematics", "Network Theory", "Signals and Systems", "Electronic Devices", "Analog Circuits", "Digital Circuits", "Control Systems", "Communications", "Electromagnetics"]],
  ["EE", "Electrical Engineering", ["Engineering Mathematics", "Electric Circuits and Fields", "Signals and Systems", "Electrical Machines", "Power Systems", "Control Systems", "Power Electronics", "Measurements", "Analog and Digital Electronics"]],
  ["ES", "Environmental Science and Engineering", ["Engineering Mathematics", "Environmental Chemistry", "Ecology", "Environmental Pollution", "Water and Wastewater", "Environmental Management"]],
  ["EY", "Ecology and Evolution", ["Ecology", "Evolution", "Genetics", "Population Biology", "Animal Behaviour", "Physiology"]],
  ["GE", "Geomatics Engineering", ["Engineering Mathematics", "Geomatics", "Remote Sensing", "Geographic Information Systems", "Surveying", "GNSS and Positioning"]],
  ["GG", "Geology and Geophysics", ["Geology", "Geophysics", "Earth Materials", "Structural Geology", "Geomorphology", "Geophysical Methods"]],
  ["IN", "Instrumentation Engineering", ["Engineering Mathematics", "Electrical Circuits", "Signals and Systems", "Control Systems", "Sensors and Transducers", "Industrial Instrumentation", "Process Control", "Analog and Digital Electronics"]],
  ["MA", "Mathematics", ["Real Analysis", "Complex Analysis", "Linear Algebra", "Algebra", "Numerical Analysis", "Differential Equations", "Probability and Statistics", "Topology"]],
  ["ME", "Mechanical Engineering", ["Engineering Mathematics", "Engineering Mechanics", "Strength of Materials", "Theory of Machines", "Thermodynamics", "Fluid Mechanics", "Heat Transfer", "Manufacturing", "Machine Design", "Industrial Engineering"]],
  ["MN", "Mining Engineering", ["Engineering Mathematics", "Mine Development and Surveying", "Mining Geology", "Rock Mechanics", "Mine Ventilation", "Mine Economics"]],
  ["MT", "Metallurgical Engineering", ["Engineering Mathematics", "Extractive Metallurgy", "Physical Metallurgy", "Mechanical Metallurgy", "Thermodynamics and Kinetics", "Materials Characterization"]],
  ["NM", "Naval Architecture and Marine Engineering", ["Engineering Mathematics", "Ship Hydrodynamics", "Marine Structures", "Marine Engineering", "Ship Design", "Offshore Engineering"]],
  ["PE", "Petroleum Engineering", ["Engineering Mathematics", "Petroleum Exploration", "Drilling Technology", "Reservoir Engineering", "Production Engineering", "Well Testing"]],
  ["PH", "Physics", ["Mathematical Physics", "Classical Mechanics", "Electromagnetic Theory", "Quantum Mechanics", "Thermodynamics and Statistical Physics", "Atomic and Molecular Physics", "Solid State Physics", "Nuclear Physics"]],
  ["PI", "Production and Industrial Engineering", ["Engineering Mathematics", "Engineering Materials", "Manufacturing Processes", "Operations Research", "Quality and Reliability", "Industrial Engineering", "Production Planning"]],
  ["ST", "Statistics", ["Probability and Statistics", "Linear Models", "Statistical Inference", "Regression Analysis", "Time Series", "Multivariate Analysis", "Stochastic Processes"]],
  ["TF", "Textile Engineering and Fibre Science", ["Engineering Mathematics", "Textile Fibres", "Yarn Manufacturing", "Fabric Manufacturing", "Textile Chemical Processing", "Textile Testing"]],
  ["XE", "Engineering Sciences", ["Engineering Mathematics", "Fluid Mechanics", "Materials Science", "Solid Mechanics", "Thermodynamics", "Polymer Science", "Food Technology", "Energy Science"]],
  ["XH", "Humanities and Social Sciences", ["Reasoning and Comprehension", "Economics", "English", "Linguistics", "Philosophy", "Psychology", "Sociology"]],
  ["XL", "Life Sciences", ["Chemistry", "Biochemistry", "Botany", "Microbiology", "Zoology", "Food Technology"]],
];

async function seedGateCatalogue() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);

  let subjectCount = 0;
  for (const [code, name, subjectNames] of branchDefinitions) {
    const branch = await Branch.findOneAndUpdate(
      { code },
      { $set: { name, description: `GATE ${code} preparation path`, isActive: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    for (const [index, subjectName] of subjectNames.entries()) {
      await Subject.updateOne(
        { branch: branch._id, name: subjectName },
        {
          $set: {
            code: `${code}-${String(index + 1).padStart(2, "0")}`,
            description: `${subjectName} practice for ${name}.`,
            isActive: true,
          },
        },
        { upsert: true }
      );
      subjectCount += 1;
    }
  }

  console.log(`GATE catalogue ready: ${branchDefinitions.length} branches, ${subjectCount} subjects processed.`);
}

seedGateCatalogue()
  .then(() => mongoose.disconnect())
  .catch(error => {
    console.error("Unable to seed the GATE catalogue:", error.message);
    mongoose.disconnect().finally(() => { process.exitCode = 1; });
  });
